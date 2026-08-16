#include "PositionBasedDynamics/PositionBasedDynamics.h"

#include <cmath>

namespace {

constexpr double kMaximumAbsoluteInput = 1000000.0;
constexpr double kMaximumRestLength = 2000000.0;

struct DistanceResult {
    int status;
    double correction0;
    double correction1;
};

bool finite(double value) {
    return std::isfinite(value);
}

DistanceResult solve_distance(
    double x0,
    double x1,
    double rest_length,
    double inv_mass0,
    double inv_mass1,
    double stiffness) {
    if (!finite(x0) || !finite(x1) || !finite(rest_length) || !finite(inv_mass0) || !finite(inv_mass1) || !finite(stiffness)) {
        return {0, 0.0, 0.0};
    }
    if (std::abs(x0) > kMaximumAbsoluteInput || std::abs(x1) > kMaximumAbsoluteInput
        || rest_length < 0.0 || rest_length > kMaximumRestLength
        || inv_mass0 < 0.0 || inv_mass0 > kMaximumAbsoluteInput
        || inv_mass1 < 0.0 || inv_mass1 > kMaximumAbsoluteInput
        || stiffness < 0.0 || stiffness > 1.0) {
        return {0, 0.0, 0.0};
    }
    if (inv_mass0 + inv_mass1 == 0.0 || x0 == x1) {
        return {0, 0.0, 0.0};
    }

    const Vector3r p0(static_cast<Real>(x0), 0.0, 0.0);
    const Vector3r p1(static_cast<Real>(x1), 0.0, 0.0);
    Vector3r corr0 = Vector3r::Zero();
    Vector3r corr1 = Vector3r::Zero();
    const bool solved = PBD::PositionBasedDynamics::solve_DistanceConstraint(
        p0,
        static_cast<Real>(inv_mass0),
        p1,
        static_cast<Real>(inv_mass1),
        static_cast<Real>(rest_length),
        static_cast<Real>(stiffness),
        corr0,
        corr1);
    const double correction0 = static_cast<double>(corr0.x());
    const double correction1 = static_cast<double>(corr1.x());
    if (!solved || !finite(correction0) || !finite(correction1)) {
        return {0, 0.0, 0.0};
    }
    return {1, correction0, correction1};
}

} // namespace

extern "C" int pbd_solve_distance(
    double x0,
    double x1,
    double rest_length,
    double inv_mass0,
    double inv_mass1,
    double stiffness) {
    return solve_distance(x0, x1, rest_length, inv_mass0, inv_mass1, stiffness).status;
}

extern "C" double pbd_solve_distance_correction0(
    double x0,
    double x1,
    double rest_length,
    double inv_mass0,
    double inv_mass1,
    double stiffness) {
    return solve_distance(x0, x1, rest_length, inv_mass0, inv_mass1, stiffness).correction0;
}

extern "C" double pbd_solve_distance_correction1(
    double x0,
    double x1,
    double rest_length,
    double inv_mass0,
    double inv_mass1,
    double stiffness) {
    return solve_distance(x0, x1, rest_length, inv_mass0, inv_mass1, stiffness).correction1;
}
