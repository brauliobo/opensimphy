#include <jet/animation.h>
#include <jet/sph_solver2.h>
#include <jet/vector2.h>

#include <cmath>
#include <cstdint>

namespace {

constexpr int kMaximumSteps = 600;

bool bounded_steps(int steps) {
  return steps >= 0 && steps <= kMaximumSteps;
}

}  // namespace

extern "C" {

float jet_sph2_step(int32_t steps) {
  if (!bounded_steps(steps)) return NAN;

  jet::SphSolver2 solver;
  solver.setIsUsingFixedSubTimeSteps(true);
  solver.setNumberOfFixedSubTimeSteps(1);
  solver.setViscosityCoefficient(0.1);
  solver.setPseudoViscosityCoefficient(0.0);

  auto particles = solver.sphSystemData();
  particles->setTargetDensity(1000.0);
  particles->setTargetSpacing(0.25);
  particles->addParticle(jet::Vector2D(0.00, 1.00));
  particles->addParticle(jet::Vector2D(0.25, 1.00));
  particles->addParticle(jet::Vector2D(0.00, 1.25));
  particles->addParticle(jet::Vector2D(0.25, 1.25));

  for (int32_t index = 0; index < steps; index += 1) {
    solver.update(jet::Frame(index, 1.0 / 60.0));
  }

  auto positions = particles->positions();
  if (positions.size() < 1) return NAN;
  return static_cast<float>(positions[0].y);
}

}
