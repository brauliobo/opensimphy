#include <factory.h>
#include <jet/point_parallel_hash_grid_searcher2.h>

#include <memory>
#include <string>

namespace jet {

PointNeighborSearcher2Ptr Factory::buildPointNeighborSearcher2(const std::string&) {
  return std::make_shared<PointParallelHashGridSearcher2>(64, 64, 0.002);
}

}  // namespace jet
