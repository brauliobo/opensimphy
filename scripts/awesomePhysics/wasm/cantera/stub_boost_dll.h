#pragma once

#include <functional>
#include <stdexcept>
#include <string>

namespace boost {
namespace dll {
namespace load_mode {
enum type {
  search_system_folders = 1,
  append_decorations    = 2,
  rtld_global           = 4,
};

inline type operator|(type left, type right) {
  return static_cast<type>(static_cast<int>(left) | static_cast<int>(right));
}
}

template <class T>
std::function<T> import_alias(const std::string&, const std::string&, load_mode::type) {
  throw std::runtime_error("Cantera WASM does not load Python extensions");
}
}
}
