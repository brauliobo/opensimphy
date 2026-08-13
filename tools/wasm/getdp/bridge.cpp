#include <exception>
#include <string>
#include <vector>

#include "getdp.h"
#include "onelab.h"

extern "C" int opensimphy_getdp_run(int argc, const char *const *argv)
{
  if(argc < 2 || !argv) return 64;
  std::vector<std::string> args;
  args.reserve(argc);
  for(int i = 0; i < argc; ++i) args.emplace_back(argv[i] ? argv[i] : "");
  try {
    return getdp(args, onelab::server::instance());
  }
  catch(const std::exception &error) {
    fprintf(stderr, "GetDP exception: %s\n", error.what());
    return 70;
  }
  catch(...) {
    fprintf(stderr, "GetDP unknown exception\n");
    return 70;
  }
}
