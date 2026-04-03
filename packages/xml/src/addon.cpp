#include "pugixml.hpp"
#include <napi.h>
#include <string>
#include <sstream>
#include <cstring>

using namespace Napi;

// Stack buffer for "@_" + attribute name to avoid heap allocs.
static inline Value MakeAttrKey(Env env, const char* name) {
  size_t len = std::strlen(name);
  char buf[256];
  if (len + 2 < sizeof(buf)) {
    buf[0] = '@'; buf[1] = '_';
    std::memcpy(buf + 2, name, len);
    return String::New(env, buf, len + 2);
  }
  // Fallback for very long attribute names
  std::string s("@_", 2);
  s.append(name, len);
  return String::New(env, s);
}

// Convert an XML element into a JS value.
static Value ElementToNapi(Env env, const pugi::xml_node& el) {
  // No attributes and no child elements
  pugi::xml_attribute first_attr = el.first_attribute();
  pugi::xml_node first_child = el.first_child();

  // Element has zero or one text child and no attributes
  if (!first_attr) {
    if (!first_child) {
      // Empty element: <empty/>
      return String::New(env, "", 0);
    }
    pugi::xml_node second = first_child.next_sibling();
    if (!second &&
        (first_child.type() == pugi::node_pcdata ||
         first_child.type() == pugi::node_cdata)) {
      // Single text/CDATA child, no attributes
      return String::New(env, first_child.value());
    }
  }

// Attributes and/or child nodes.
  Object obj = Object::New(env);

  // Attributes
  for (pugi::xml_attribute attr = first_attr; attr;
       attr = attr.next_attribute()) {
    obj.Set(MakeAttrKey(env, attr.name()),
            String::New(env, attr.value()));
  }

  // Children: single pass.
  // Upgrade repeated child tags to arrays.
  const char* prev_tag = nullptr;
  Value prev_val;
  bool has_text = false;
  const char* single_text = nullptr;  // For single text node (no concat)
  std::string multi_text;             // Only allocated if multiple text nodes

  for (pugi::xml_node child = first_child; child;
       child = child.next_sibling()) {
    pugi::xml_node_type type = child.type();

    if (type == pugi::node_pcdata || type == pugi::node_cdata) {
      if (!has_text) {
        single_text = child.value();
        has_text = true;
      } else {
        if (single_text) {
          multi_text = single_text;
          single_text = nullptr;
        }
        multi_text += child.value();
      }
      continue;
    }

    if (type != pugi::node_element) continue;

    const char* tag = child.name();
    Value val = ElementToNapi(env, child);

    // Check if this tag matches a previous sibling with the same name.
    // For the common case of consecutive repeated tags, we track prev_tag.
    if (prev_tag && std::strcmp(prev_tag, tag) == 0) {
      // Same as previous. It's already been set on obj.
      // Check if it's already an array.
      Value existing = obj.Get(tag);
      if (existing.IsArray()) {
        Array arr = existing.As<Array>();
        arr.Set(arr.Length(), val);
      } else {
        // Upgrade to array
        Array arr = Array::New(env, 2);
        arr.Set(static_cast<uint32_t>(0), existing);
        arr.Set(static_cast<uint32_t>(1), val);
        obj.Set(tag, arr);
      }
    } else {
      // Different tag. Check if we've seen it before (non-consecutive repeats).
      bool has_prop = obj.Has(tag);
      if (has_prop) {
        Value existing = obj.Get(tag);
        if (existing.IsArray()) {
          Array arr = existing.As<Array>();
          arr.Set(arr.Length(), val);
        } else {
          Array arr = Array::New(env, 2);
          arr.Set(static_cast<uint32_t>(0), existing);
          arr.Set(static_cast<uint32_t>(1), val);
          obj.Set(tag, arr);
        }
      } else {
        obj.Set(tag, val);
      }
    }
    prev_tag = tag;
    prev_val = val;
  }

  if (has_text) {
    if (single_text) {
      obj.Set("#text", String::New(env, single_text));
    } else {
      obj.Set("#text", String::New(env, multi_text));
    }
  }

  return obj;
}

// Convert an XML document to a JS Object.
static Value DocumentToNapi(Env env, const pugi::xml_document& doc) {
  Object root = Object::New(env);

  for (pugi::xml_node child = doc.first_child(); child;
       child = child.next_sibling()) {
    if (child.type() == pugi::node_declaration) {
      Object decl = Object::New(env);
      for (pugi::xml_attribute attr = child.first_attribute(); attr;
           attr = attr.next_attribute()) {
        decl.Set(std::string("@_") + attr.name(),
                 String::New(env, attr.value()));
      }
      root.Set("?xml", decl);
    } else if (child.type() == pugi::node_element) {
      root.Set(child.name(), ElementToNapi(env, child));
    }
  }

  return root;
}

// Convert a JS value to string for XML text content.
static std::string ValueToString(Env env, Value val) {
  if (val.IsString()) return val.As<String>().Utf8Value();
  if (val.IsNumber()) {
    double d = val.As<Number>().DoubleValue();
    if (d == static_cast<int64_t>(d) &&
        d >= -9007199254740991.0 && d <= 9007199254740991.0) {
      return std::to_string(static_cast<long long>(d));
    }
    std::ostringstream oss;
    oss << d;
    return oss.str();
  }
  if (val.IsBoolean()) return val.As<Boolean>().Value() ? "true" : "false";
  if (val.IsNull() || val.IsUndefined()) return "";
  return val.ToString().Utf8Value();
}

// Write a JS value as XML child element(s) of parent.
static void NapiToElement(Env env, pugi::xml_node& parent,
                          const std::string& tag, Value val) {
  if (val.IsArray()) {
    // Repeated elements with the same tag
    Array arr = val.As<Array>();
    for (uint32_t i = 0; i < arr.Length(); i++) {
      NapiToElement(env, parent, tag, arr.Get(i));
    }
    return;
  }

  if (val.IsObject() && !val.IsNull()) {
    Object obj = val.As<Object>();
    pugi::xml_node el = parent.append_child(tag.c_str());
    Array keys = obj.GetPropertyNames();
    for (uint32_t i = 0; i < keys.Length(); i++) {
      std::string key = keys.Get(i).As<String>().Utf8Value();
      Value v = obj.Get(key);
      if (key.size() > 2 && key[0] == '@' && key[1] == '_') {
        // Attribute
        el.append_attribute(key.substr(2).c_str())
            .set_value(ValueToString(env, v).c_str());
      } else if (key == "#text") {
        // Text content
        el.append_child(pugi::node_pcdata)
            .set_value(ValueToString(env, v).c_str());
      } else {
        // Child element
        NapiToElement(env, el, key, v);
      }
    }
    return;
  }

  // Primitives: string, number, boolean, null
  pugi::xml_node el = parent.append_child(tag.c_str());
  std::string s = ValueToString(env, val);
  if (!s.empty()) {
    el.append_child(pugi::node_pcdata).set_value(s.c_str());
  }
}

// Build an XML document from a JS object.
static void NapiToDocument(Env env, pugi::xml_document& doc, Value val) {
  if (!val.IsObject() || val.IsNull()) {
    throw std::runtime_error("stringify: expected an object");
  }
  Object obj = val.As<Object>();
  Array keys = obj.GetPropertyNames();
  for (uint32_t i = 0; i < keys.Length(); i++) {
    std::string key = keys.Get(i).As<String>().Utf8Value();
    Value v = obj.Get(key);
    if (key == "?xml") {
      // XML declaration
      pugi::xml_node decl = doc.prepend_child(pugi::node_declaration);
      if (v.IsObject() && !v.IsNull()) {
        Object declObj = v.As<Object>();
        Array dkeys = declObj.GetPropertyNames();
        for (uint32_t j = 0; j < dkeys.Length(); j++) {
          std::string dk = dkeys.Get(j).As<String>().Utf8Value();
          if (dk.size() > 2 && dk[0] == '@' && dk[1] == '_') {
            decl.append_attribute(dk.substr(2).c_str())
                .set_value(
                    declObj.Get(dk).As<String>().Utf8Value().c_str());
          }
        }
      }
    } else {
      NapiToElement(env, doc, key, v);
    }
  }
}

// Custom writer that appends to a std::string.
struct StringWriter : pugi::xml_writer {
  std::string result;
  void write(const void* data, size_t size) override {
    result.append(static_cast<const char*>(data), size);
  }
};

static Value Parse(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsString()) {
    TypeError::New(env, "parse: expected a string argument")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  std::string input = info[0].As<String>().Utf8Value();

  try {
    pugi::xml_document doc;
    pugi::xml_parse_result result = doc.load_buffer(
        input.data(), input.size(),
        pugi::parse_default | pugi::parse_declaration | pugi::parse_cdata);
    if (!result) {
      throw std::runtime_error(
          std::string("at offset ") +
          std::to_string(result.offset) + ": " + result.description());
    }
    return DocumentToNapi(env, doc);
  } catch (const std::exception& e) {
    Error::New(env, std::string("XML parse error: ") + e.what())
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
    pugi::xml_document doc;
    NapiToDocument(env, doc, info[0]);
    if (env.IsExceptionPending()) return env.Undefined();

    StringWriter writer;
    // Use format_indent for pretty output. Skip auto-declaration since
    // we handle "?xml" explicitly in the document tree.
    unsigned int flags = pugi::format_indent;
    // Only suppress the auto declaration. If a declaration node exists
    // in the tree it will still be written.
    doc.save(writer, "  ", flags | pugi::format_no_declaration);
    // If the doc has a declaration, re-save with declaration included.
    if (doc.first_child().type() == pugi::node_declaration) {
      writer.result.clear();
      doc.save(writer, "  ", flags);
    }
    return String::New(env, writer.result);
  } catch (const std::exception& e) {
    Error::New(env, std::string("XML stringify error: ") + e.what())
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Object Init(Env env, Object exports) {
  exports.Set("parse", Function::New(env, Parse));
  exports.Set("stringify", Function::New(env, Stringify));
  return exports;
}

NODE_API_MODULE(cppparse_xml, Init)
