cmake_minimum_required(VERSION 3.27...3.31)
project(cantera-headless-wasm LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
string(APPEND CMAKE_CXX_FLAGS " -fwasm-exceptions")
set(CANTERA_SOURCE "" CACHE PATH "Pinned Cantera checkout")
set(CANTERA_H2O2_YAML "${CMAKE_CURRENT_SOURCE_DIR}/h2o2.yaml" CACHE FILEPATH "Selected h2o2.yaml")
set(CANTERA_VERSION "4.0.0a2")
set(CANTERA_SHORT_VERSION "4.0")
set(CANTERA_GIT_COMMIT "11a2381011cb6d42e61cc4c195e0f920864bf8d3")

if(NOT CANTERA_SOURCE)
  message(FATAL_ERROR "CANTERA_SOURCE must be the pinned Cantera checkout")
endif()

set(CANTERA_ENABLE_LAPACK OFF)
set(CT_USE_HDF5 0)
set(CT_USE_SYSTEM_HIGHFIVE 0)
set(BUILD_TESTING OFF)
set(CMAKE_POLICY_VERSION_MINIMUM 3.5)
set(BUILD_SHARED_LIBS OFF)
set(CMAKE_Fortran_COMPILER NOTFOUND)

include(FetchContent)

set(EIGEN_VERSION 3.4.0)
FetchContent_Declare(
  eigen
  URL https://gitlab.com/libeigen/eigen/-/archive/${EIGEN_VERSION}/eigen-${EIGEN_VERSION}.tar.bz2
  URL_HASH SHA256=b4c198460eba6f28d34894e3a5710998818515104d6e74e5cc331ce31e46e626
)

set(YAML_CPP_VERSION 0.8.0)
FetchContent_Declare(
  yaml-cpp
  URL https://github.com/jbeder/yaml-cpp/archive/refs/tags/${YAML_CPP_VERSION}.tar.gz
  URL_HASH SHA256=fbe74bbdcee21d656715688706da3c8becfd946d92cd44705cc6098bb23b3a16
)

set(SUNDIALS_VERSION 7.4.0)
FetchContent_Declare(
  sundials
  URL https://github.com/LLNL/sundials/releases/download/v${SUNDIALS_VERSION}/sundials-${SUNDIALS_VERSION}.tar.gz
  URL_HASH SHA256=679ddacdd77610110e613164e8297d6d0cd35bae8e9c3afc8e8ff6f99a1c2a7b
)

set(FMT_VERSION 11.2.0)
FetchContent_Declare(
  fmt
  URL https://github.com/fmtlib/fmt/releases/download/${FMT_VERSION}/fmt-${FMT_VERSION}.zip
  URL_HASH SHA256=203eb4e8aa0d746c62d8f903df58e0419e3751591bb53ff971096eaa0ebd4ec3
)

set(EXAMPLES_INSTALL OFF)
set(EXAMPLES_ENABLE_C OFF)
set(BUILD_ARKODE OFF)
set(BUILD_CVODE OFF)
set(BUILD_IDA OFF)
set(BUILD_KINSOL OFF)
set(BUILD_CPODES OFF)
set(BUILD_FORTRAN_MODULE_INTERFACE OFF)
set(ENABLE_LAPACK OFF)
set(ENABLE_OPENMP OFF)
set(ENABLE_PTHREAD OFF)
set(ENABLE_MPI OFF)
set(ENABLE_POSIX_TIMERS OFF)
set(FMT_INSTALL OFF)
set(FMT_DOC OFF)
set(FMT_TEST OFF)
set(FMT_MASTER_PROJECT OFF)
set(FMT_OS OFF)
set(EIGEN_BUILD_DOC OFF)
set(YAML_CPP_FORMAT_SOURCE OFF)
set(YAML_CPP_INSTALL OFF)
set(YAML_CPP_BUILD_TESTS OFF)
set(YAML_CPP_BUILD_TOOLS OFF)
set(YAML_BUILD_SHARED_LIBS OFF)

add_compile_options(
  "-ffile-prefix-map=${CANTERA_SOURCE}=/src/cantera"
  "-ffile-prefix-map=${CMAKE_BINARY_DIR}=/build/cantera"
  "-ffile-prefix-map=${CMAKE_CURRENT_SOURCE_DIR}=/opensimphy/cantera")

FetchContent_MakeAvailable(eigen yaml-cpp sundials fmt)

file(MAKE_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}/boost_include")
file(CREATE_LINK "/usr/include/boost" "${CMAKE_CURRENT_BINARY_DIR}/boost_include/boost" SYMBOLIC)
set(Boost_INCLUDE_DIRS "${CMAKE_CURRENT_BINARY_DIR}/boost_include")
if(NOT EXISTS "/usr/include/boost/version.hpp")
  message(FATAL_ERROR "Boost headers are missing at /usr/include/boost/version.hpp")
endif()

file(GLOB_RECURSE CT_LIB_SOURCES "${CANTERA_SOURCE}/src/*.cpp")
list(FILTER CT_LIB_SOURCES EXCLUDE REGEX "/extensions/")
list(FILTER CT_LIB_SOURCES EXCLUDE REGEX "/oneD/")
list(FILTER CT_LIB_SOURCES EXCLUDE REGEX "/fortran/")
list(FILTER CT_LIB_SOURCES EXCLUDE REGEX "/pch/")
list(APPEND CT_LIB_SOURCES "${CANTERA_SOURCE}/src/extensions/canteraStatic.cpp")

file(READ "${CANTERA_SOURCE}/src/base/application.cpp" CANTERA_APPLICATION_CPP)
string(REPLACE
  "#define BOOST_DLL_USE_STD_FS\n#include <boost/dll/import.hpp>"
  "#include \"stub_boost_dll.h\""
  CANTERA_APPLICATION_CPP
  "${CANTERA_APPLICATION_CPP}")
file(WRITE "${CMAKE_CURRENT_BINARY_DIR}/application.cpp" "${CANTERA_APPLICATION_CPP}")
list(FILTER CT_LIB_SOURCES EXCLUDE REGEX "/base/application\\.cpp$")
list(APPEND CT_LIB_SOURCES "${CMAKE_CURRENT_BINARY_DIR}/application.cpp")

file(READ "${CANTERA_SOURCE}/src/thermo/Phase.cpp" CANTERA_PHASE_CPP)
string(REPLACE
  "#include \"cantera/thermo/ThermoFactory.h\""
  "#include \"cantera/thermo/ThermoFactory.h\"\n#include \"element_entropies_yaml.h\""
  CANTERA_PHASE_CPP
  "${CANTERA_PHASE_CPP}")
string(REPLACE
  "AnyMap::fromYamlFile(\n                \"element-standard-entropies.yaml\")"
  "AnyMap::fromYamlString(kElementEntropiesYaml)"
  CANTERA_PHASE_CPP
  "${CANTERA_PHASE_CPP}")
string(REPLACE
  "AnyMap::fromYamlFile(\"element-standard-entropies.yaml\")"
  "AnyMap::fromYamlString(kElementEntropiesYaml)"
  CANTERA_PHASE_CPP
  "${CANTERA_PHASE_CPP}")
file(WRITE "${CMAKE_CURRENT_BINARY_DIR}/Phase.cpp" "${CANTERA_PHASE_CPP}")
list(FILTER CT_LIB_SOURCES EXCLUDE REGEX "/thermo/Phase\\.cpp$")
list(APPEND CT_LIB_SOURCES "${CMAKE_CURRENT_BINARY_DIR}/Phase.cpp")

file(COPY "${CANTERA_SOURCE}/include/" DESTINATION "${CMAKE_CURRENT_BINARY_DIR}/include")
configure_file("${CMAKE_CURRENT_SOURCE_DIR}/config.h.in" "${CMAKE_CURRENT_BINARY_DIR}/include/cantera/base/config.h" @ONLY)
file(READ "${CANTERA_H2O2_YAML}" H2O2_YAML_TEXT)
configure_file("${CMAKE_CURRENT_SOURCE_DIR}/h2o2_yaml.h.in" "${CMAKE_CURRENT_BINARY_DIR}/h2o2_yaml.h" @ONLY)
file(READ "${CMAKE_CURRENT_SOURCE_DIR}/element-standard-entropies.yaml" ELEMENT_ENTROPIES_YAML_TEXT)
configure_file("${CMAKE_CURRENT_SOURCE_DIR}/element_entropies_yaml.h.in" "${CMAKE_CURRENT_BINARY_DIR}/element_entropies_yaml.h" @ONLY)

add_library(cantera_lib STATIC ${CT_LIB_SOURCES})
target_include_directories(cantera_lib PRIVATE
  "${CMAKE_CURRENT_SOURCE_DIR}"
  "${CMAKE_CURRENT_BINARY_DIR}"
  "${CMAKE_CURRENT_BINARY_DIR}/include"
  "${CANTERA_SOURCE}/src"
  "${CANTERA_SOURCE}/src/base")
target_compile_options(cantera_lib PRIVATE
  -fwasm-exceptions
  "-ffile-prefix-map=${CANTERA_SOURCE}=/src/cantera"
  "-ffile-prefix-map=${CMAKE_BINARY_DIR}=/build/cantera"
  "-ffile-prefix-map=${CMAKE_CURRENT_SOURCE_DIR}=/opensimphy/cantera")
target_include_directories(cantera_lib SYSTEM PRIVATE "${Boost_INCLUDE_DIRS}")
target_compile_definitions(cantera_lib PRIVATE
  GIT_COMMIT="${CANTERA_GIT_COMMIT}"
  CANTERA_DATA=""
  BOOST_STACKTRACE_USE_NOOP)
target_link_libraries(cantera_lib PUBLIC
  yaml-cpp::yaml-cpp
  Eigen3::Eigen
  SUNDIALS::core
  SUNDIALS::nvecserial
  SUNDIALS::cvodes
  SUNDIALS::idas
  SUNDIALS::sunmatrixband
  SUNDIALS::sunmatrixdense
  SUNDIALS::sunmatrixsparse
  SUNDIALS::sunlinsolspgmr
  SUNDIALS::sunlinsoldense
  SUNDIALS::sunlinsolband
  SUNDIALS::sunnonlinsolnewton
  fmt::fmt)

add_executable(cantera_abi "${CMAKE_CURRENT_SOURCE_DIR}/cantera_abi.cpp")
target_include_directories(cantera_abi PRIVATE
  "${CMAKE_CURRENT_BINARY_DIR}"
  "${CMAKE_CURRENT_BINARY_DIR}/include")
target_compile_options(cantera_abi PRIVATE -fwasm-exceptions)
target_link_libraries(cantera_abi PRIVATE cantera_lib)
target_link_options(cantera_abi PRIVATE
  -fwasm-exceptions
  --no-entry
  "SHELL:-s STANDALONE_WASM=1"
  "SHELL:-s FILESYSTEM=0"
  "SHELL:-s ALLOW_MEMORY_GROWTH=1"
  "SHELL:-s MAXIMUM_MEMORY=268435456"
  "SHELL:-s INITIAL_MEMORY=33554432"
  "SHELL:-s ERROR_ON_UNDEFINED_SYMBOLS=1"
  "SHELL:-s EXPORTED_FUNCTIONS=['_cantera_run','_cantera_out','_cantera_status']")
set_target_properties(cantera_abi PROPERTIES OUTPUT_NAME cantera SUFFIX ".wasm")
