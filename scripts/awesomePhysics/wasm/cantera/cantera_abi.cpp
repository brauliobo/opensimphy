#include "cantera/core.h"
#include "cantera/zerodim.h"
#include "h2o2_yaml.h"

#include <cmath>
#include <string>

using namespace Cantera;

namespace {

constexpr double kMinTemperature = 200.0;
constexpr double kMaxTemperature = 3000.0;
constexpr double kMinPressure    = 1.0e3;
constexpr double kMaxPressure    = 1.0e7;
constexpr double kMinTime        = 0.0;
constexpr double kMaxTime        = 1.0e-2;
constexpr int    kOutputCount    = 8;

double g_out[kOutputCount];
int    g_status = 0;

bool finite_range(double value, double minimum, double maximum) {
  return std::isfinite(value) && value >= minimum && value <= maximum;
}

void clear_outputs() {
  for (int index = 0; index < kOutputCount; index += 1) g_out[index] = 0.0;
}

shared_ptr<Solution> load_ohmech() {
  AnyMap root = AnyMap::fromYamlString(kH2o2Yaml);
  const AnyMap& phase = root["phases"].getMapWhere("name", "ohmech");
  return newSolution(phase, root, "none");
}

int fail(int status) {
  g_status = status;
  return 0;
}

} // namespace

extern "C" double cantera_out(int index) {
  if (index < 0 || index >= kOutputCount) return std::nan("");
  return g_out[index];
}

extern "C" int cantera_status() {
  return g_status;
}

extern "C" int cantera_run(int op, double temperature, double pressure, double time) {
  g_status = 0;
  clear_outputs();
  if (!finite_range(temperature, kMinTemperature, kMaxTemperature)) return fail(1);
  if (!finite_range(pressure, kMinPressure, kMaxPressure)) return fail(1);
  if (op == 2 && !finite_range(time, kMinTime, kMaxTime)) return fail(1);

  try {
    auto sol = load_ohmech();
    auto gas = sol->thermo();
    gas->setState_TPX(temperature, pressure, "H2:2.0, O2:1.0, N2:4.0");

    if (op == 0) {
      g_out[0] = gas->enthalpy_mass();
      g_out[1] = gas->cp_mass();
      g_out[2] = gas->density();
      g_out[3] = gas->temperature();
      g_out[4] = gas->pressure();
      return 1;
    }

    if (op == 1) {
      gas->equilibrate("HP");
      g_out[0] = gas->temperature();
      g_out[1] = gas->enthalpy_mass();
      g_out[2] = gas->density();
      g_out[3] = gas->pressure();
      return 1;
    }

    if (op == 2) {
      auto reactor = newReactorBase("IdealGasConstPressureReactor", sol, true);
      ReactorNet network(reactor);
      network.advance(time);
      auto thermo = reactor->phase()->thermo();
      g_out[0] = thermo->temperature();
      g_out[1] = thermo->enthalpy_mass();
      g_out[2] = thermo->moleFraction("OH");
      g_out[3] = time;
      return 1;
    }

    return fail(1);
  } catch (...) {
    return fail(2);
  }
}
