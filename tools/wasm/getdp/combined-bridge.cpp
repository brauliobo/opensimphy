#include <emscripten/heap.h>

#include <exception>
#include <stdint.h>
#include <string>
#include <vector>

#include "getdp.h"
#include "onelab.h"
#include "onelabUtils.h"

namespace {
std::string lastError;
bool aborted = false;
unsigned long getdpCalls = 0;
unsigned long loopInitializeCalls = 0;
unsigned long loopIncrementCalls = 0;
unsigned long jsonImportCalls = 0;
unsigned long jsonExportCalls = 0;
uintptr_t lastGetdpServer = 0;

int runGetdp(int argc, const char *const *argv)
{
  if(argc < 2 || !argv) return 64;
  std::vector<std::string> args;
  args.reserve(argc);
  for(int i = 0; i < argc; ++i) args.emplace_back(argv[i] ? argv[i] : "");
  onelab::server *server = onelab::server::instance();
  lastGetdpServer = reinterpret_cast<uintptr_t>(server);
  getdpCalls++;
  return getdp(args, server);
}

template <class Function> int guarded(Function function)
{
  lastError.clear();
  try { return function(); }
  catch(const std::exception &error) {
    lastError = error.what();
    return 70;
  }
  catch(...) {
    lastError = "unknown native exception";
    return 70;
  }
}
}

extern "C" int opensimphy_combined_run(int argc, const char *const *argv)
{
  if(aborted) return 125;
  return guarded([&] { return runGetdp(argc, argv); });
}

extern "C" int opensimphy_combined_onelab_set_json(const char *json)
{
  if(!json) return 64;
  jsonImportCalls++;
  return guarded([&] {
    return onelab::server::instance()->fromJSON(json) ? 0 : 65;
  });
}

extern "C" const char *opensimphy_combined_onelab_get_json()
{
  static std::string json;
  jsonExportCalls++;
  if(!onelab::server::instance()->toJSON(json, "OpenSimPhy/Combined")) return nullptr;
  return json.c_str();
}

extern "C" void opensimphy_combined_onelab_clear()
{
  onelab::server::instance()->clear();
}

extern "C" int opensimphy_combined_onelab_get_changed()
{
  return onelab::server::instance()->getChanged();
}

extern "C" void opensimphy_combined_onelab_set_changed(int value)
{
  onelab::server::instance()->setChanged(value);
}

extern "C" int opensimphy_combined_loop_initialize(int limit)
{
  aborted = false;
  loopInitializeCalls++;
  onelabUtils::initializeLoops();
  int points = 1;
  while(onelabUtils::incrementLoops()) {
    loopIncrementCalls++;
    if(++points > limit) {
      onelabUtils::initializeLoops();
      return -75;
    }
  }
  onelabUtils::initializeLoops();
  return points;
}

extern "C" int opensimphy_combined_loop_increment()
{
  if(aborted) return 0;
  loopIncrementCalls++;
  return onelabUtils::incrementLoops();
}

extern "C" uintptr_t opensimphy_combined_server_identity()
{
  return reinterpret_cast<uintptr_t>(onelab::server::instance());
}

extern "C" uintptr_t opensimphy_combined_last_getdp_server_identity()
{
  return lastGetdpServer;
}

extern "C" unsigned long opensimphy_combined_getdp_calls()
{
  return getdpCalls;
}

extern "C" unsigned long opensimphy_combined_loop_initialize_calls()
{
  return loopInitializeCalls;
}

extern "C" unsigned long opensimphy_combined_loop_increment_calls()
{
  return loopIncrementCalls;
}

extern "C" unsigned long opensimphy_combined_json_import_calls()
{
  return jsonImportCalls;
}

extern "C" unsigned long opensimphy_combined_json_export_calls()
{
  return jsonExportCalls;
}

extern "C" void opensimphy_combined_abort()
{
  aborted = true;
}

extern "C" void opensimphy_combined_close()
{
  aborted = false;
  lastError.clear();
  onelab::server::instance()->clear();
}

extern "C" const char *opensimphy_combined_last_error()
{
  return lastError.c_str();
}

extern "C" size_t opensimphy_combined_heap_bytes()
{
  return emscripten_get_heap_size();
}
