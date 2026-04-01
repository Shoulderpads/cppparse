#define RYML_SINGLE_HDR_DEFINE_NOW
#include "ryml_all.hpp"
#include <napi.h>
#include <string>
#include <stdexcept>
#include <cmath>

using namespace Napi;

// Error callbacks that throw instead of aborting. rapidyaml requires these
// to be [[noreturn]]; we throw so the catch blocks in Parse/Stringify can
// convert to JS exceptions.

[[noreturn]] static void on_ryml_error_basic(ryml::csubstr msg, ryml::ErrorDataBasic const&, void*) {
  throw std::runtime_error(std::string(msg.str, msg.len));
}

[[noreturn]] static void on_ryml_error_parse(ryml::csubstr msg, ryml::ErrorDataParse const&, void*) {
  throw std::runtime_error(std::string(msg.str, msg.len));
}

[[noreturn]] static void on_ryml_error_visit(ryml::csubstr msg, ryml::ErrorDataVisit const&, void*) {
  throw std::runtime_error(std::string(msg.str, msg.len));
}

static void install_error_handlers() {
  ryml::Callbacks cb;
  cb.set_error_basic(on_ryml_error_basic);
  cb.set_error_parse(on_ryml_error_parse);
  cb.set_error_visit(on_ryml_error_visit);
  ryml::set_callbacks(cb);
}

// Recursively convert a ryml node into its Napi equivalent.
static Value NodeToNapi(Env env, const ryml::ConstNodeRef& node) {
  if (node.is_seed()) return env.Null();

  if (node.is_seq()) {
    Array arr = Array::New(env, node.num_children());
    uint32_t i = 0;
    for (const auto& child : node.children())
      arr.Set(i++, NodeToNapi(env, child));
    return arr;
  }

  if (node.is_map()) {
    Object obj = Object::New(env);
    for (const auto& child : node.children()) {
      if (!child.has_key()) continue;
      ryml::csubstr key = child.key();
      obj.Set(std::string(key.str, key.len), NodeToNapi(env, child));
    }
    return obj;
  }

  if (node.has_val()) {
    ryml::csubstr val = node.val();
    std::string s(val.str, val.len);

    if (node.val_is_null()) return env.Null();
    if (node.is_val_quoted()) return String::New(env, s);

    // booleans
    if (s == "true"  || s == "True"  || s == "TRUE")  return Boolean::New(env, true);
    if (s == "false" || s == "False" || s == "FALSE") return Boolean::New(env, false);

    // numbers (only unquoted scalars)
    if (!s.empty() && (s[0] == '-' || s[0] == '+' || (s[0] >= '0' && s[0] <= '9'))) {
      bool has_dot = false;
      for (char c : s)
        if (c == '.' || c == 'e' || c == 'E') { has_dot = true; break; }

      char* end = nullptr;
      if (has_dot) {
        double d = std::strtod(s.c_str(), &end);
        if (end == s.c_str() + s.size()) return Number::New(env, d);
      } else {
        long long ll = std::strtoll(s.c_str(), &end, 10);
        if (end == s.c_str() + s.size() &&
            ll >= -9007199254740991LL && ll <= 9007199254740991LL)
          return Number::New(env, static_cast<double>(ll));
      }
    }

    // special floats
    if (s == ".inf"  || s == ".Inf"  || s == ".INF")  return Number::New(env,  std::numeric_limits<double>::infinity());
    if (s == "-.inf" || s == "-.Inf" || s == "-.INF") return Number::New(env, -std::numeric_limits<double>::infinity());
    if (s == ".nan"  || s == ".NaN"  || s == ".NAN")  return Number::New(env,  std::numeric_limits<double>::quiet_NaN());

    return String::New(env, s);
  }

  return env.Null();
}

// Recursively populate a ryml tree from a JS value.
static void NapiToTree(Env env, ryml::NodeRef node, Value val) {
  if (val.IsNull() || val.IsUndefined()) {
    node |= ryml::VAL;
    node.set_val(ryml::csubstr("null", 4));
    return;
  }

  if (val.IsBoolean()) {
    node |= ryml::VAL;
    bool b = val.As<Boolean>().Value();
    node.set_val(b ? ryml::csubstr("true", 4) : ryml::csubstr("false", 5));
    return;
  }

  if (val.IsNumber()) {
    node |= ryml::VAL;
    double d = val.As<Number>().DoubleValue();
    if (std::isnan(d)) {
      node.set_val(ryml::csubstr(".nan", 4));
    } else if (std::isinf(d)) {
      node.set_val(d > 0 ? ryml::csubstr(".inf", 4) : ryml::csubstr("-.inf", 5));
    } else if (d == static_cast<int64_t>(d) &&
               d >= -9007199254740991.0 && d <= 9007199254740991.0) {
      char buf[32];
      int len = snprintf(buf, sizeof(buf), "%lld", static_cast<long long>(d));
      node.set_val(node.tree()->copy_to_arena(ryml::csubstr(buf, static_cast<size_t>(len))));
    } else {
      char buf[64];
      int len = snprintf(buf, sizeof(buf), "%.17g", d);
      node.set_val(node.tree()->copy_to_arena(ryml::csubstr(buf, static_cast<size_t>(len))));
    }
    return;
  }

  if (val.IsString()) {
    node |= ryml::VAL;
    std::string s = val.As<String>().Utf8Value();
    node.set_val(node.tree()->copy_to_arena(ryml::csubstr(s.c_str(), s.size())));
    node |= ryml::VAL_DQUO;
    return;
  }

  if (val.IsArray()) {
    Array arr = val.As<Array>();
    node |= ryml::SEQ;
    for (uint32_t i = 0, len = arr.Length(); i < len; i++) {
      ryml::NodeRef child = node.append_child();
      NapiToTree(env, child, arr.Get(i));
    }
    return;
  }

  if (val.IsObject()) {
    Object obj = val.As<Object>();
    node |= ryml::MAP;
    Array keys = obj.GetPropertyNames();
    for (uint32_t i = 0, len = keys.Length(); i < len; i++) {
      std::string key = keys.Get(i).As<String>().Utf8Value();
      ryml::NodeRef child = node.append_child();
      child |= ryml::KEY;
      child.set_key(node.tree()->copy_to_arena(ryml::csubstr(key.c_str(), key.size())));
      NapiToTree(env, child, obj.Get(key));
    }
    return;
  }

  node |= ryml::VAL;
  node.set_val(ryml::csubstr("null", 4));
}

static Value Parse(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsString()) {
    TypeError::New(env, "parse: expected a string argument")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  std::string input = info[0].As<String>().Utf8Value();

  try {
    install_error_handlers();
    ryml::Tree tree = ryml::parse_in_place(ryml::to_substr(input));
    tree.resolve();
    return NodeToNapi(env, tree.crootref());
  } catch (const std::exception& e) {
    Error::New(env, std::string("YAML parse error: ") + e.what())
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

static Value Stringify(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() < 1) {
    TypeError::New(env, "stringify: expected a value argument")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  try {
    install_error_handlers();
    ryml::Tree tree;
    ryml::NodeRef root = tree.rootref();
    NapiToTree(env, root, info[0]);
    if (env.IsExceptionPending()) return env.Undefined();
    return String::New(env, ryml::emitrs_yaml<std::string>(tree));
  } catch (const std::exception& e) {
    Error::New(env, std::string("YAML stringify error: ") + e.what())
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Object Init(Env env, Object exports) {
  exports.Set("parse", Function::New(env, Parse));
  exports.Set("stringify", Function::New(env, Stringify));
  return exports;
}

NODE_API_MODULE(cppparse_yaml, Init)
