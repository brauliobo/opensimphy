#include <cmath>

namespace {

constexpr int kMaximumSpins = 32;
constexpr int kMaximumSteps = 4000;
constexpr double kMaximumField = 100.0;
constexpr double kMaximumExchange = 100.0;
constexpr double kMaximumDamping = 1.0;
constexpr double kMinimumTimeStep = 1e-5;
constexpr double kMaximumTimeStep = 0.05;
constexpr double kMuB = 0.057883817555;
constexpr double kGamma = 0.1760859644;

struct Vec3 {
    double x;
    double y;
    double z;
};

struct LlgResult {
    int status;
    double mx;
    double my;
    double mz;
    double energy;
    double time;
    double norm;
};

bool finite(double value) {
    return std::isfinite(value);
}

Vec3 add(Vec3 a, Vec3 b) {
    return { a.x + b.x, a.y + b.y, a.z + b.z };
}

Vec3 scale(Vec3 a, double s) {
    return { a.x * s, a.y * s, a.z * s };
}

Vec3 cross(Vec3 a, Vec3 b) {
    return {
        a.y * b.z - a.z * b.y,
        a.z * b.x - a.x * b.z,
        a.x * b.y - a.y * b.x,
    };
}

double dot(Vec3 a, Vec3 b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

double norm(Vec3 a) {
    return std::sqrt(dot(a, a));
}

bool normalize(Vec3 &value) {
    const double length = norm(value);
    if (!finite(length) || length <= 0.0) return false;
    value = scale(value, 1.0 / length);
    return finite(value.x) && finite(value.y) && finite(value.z);
}

void effective_field(const Vec3 *spins, int n, Vec3 field, double exchange, Vec3 *out) {
    for (int i = 0; i < n; i += 1) {
        Vec3 h = field;
        if (i > 0) h = add(h, scale(spins[i - 1], exchange));
        if (i + 1 < n) h = add(h, scale(spins[i + 1], exchange));
        out[i] = h;
    }
}

Vec3 virtual_field(Vec3 spin, Vec3 h, double dtg, double damping) {
    return add(scale(h, dtg), scale(cross(spin, h), dtg * damping));
}

double energy_of(const Vec3 *spins, int n, Vec3 field, double exchange) {
    double energy = 0.0;
    for (int i = 0; i < n; i += 1) {
        energy -= dot(spins[i], field);
        if (i + 1 < n) energy -= exchange * dot(spins[i], spins[i + 1]);
    }
    return energy;
}

LlgResult solve(
    int spin_count,
    double damping,
    double dt,
    int steps,
    double bx,
    double by,
    double bz,
    double exchange,
    double sx,
    double sy,
    double sz) {
    if (spin_count < 1 || spin_count > kMaximumSpins) return { 0, 0, 0, 0, 0, 0, 0 };
    if (steps < 1 || steps > kMaximumSteps) return { 0, 0, 0, 0, 0, 0, 0 };
    if (!finite(damping) || damping < 0.0 || damping > kMaximumDamping) return { 0, 0, 0, 0, 0, 0, 0 };
    if (!finite(dt) || dt < kMinimumTimeStep || dt > kMaximumTimeStep) return { 0, 0, 0, 0, 0, 0, 0 };
    if (!finite(bx) || !finite(by) || !finite(bz) || !finite(exchange) || !finite(sx) || !finite(sy) || !finite(sz)) {
        return { 0, 0, 0, 0, 0, 0, 0 };
    }
    if (std::fabs(bx) > kMaximumField || std::fabs(by) > kMaximumField || std::fabs(bz) > kMaximumField) {
        return { 0, 0, 0, 0, 0, 0, 0 };
    }
    if (std::fabs(exchange) > kMaximumExchange) return { 0, 0, 0, 0, 0, 0, 0 };

    Vec3 initial = { sx, sy, sz };
    if (!normalize(initial)) return { 0, 0, 0, 0, 0, 0, 0 };

    Vec3 spins[kMaximumSpins];
    Vec3 predictor[kMaximumSpins];
    Vec3 field_now[kMaximumSpins];
    Vec3 field_pred[kMaximumSpins];
    const Vec3 field = { bx, by, bz };
    for (int i = 0; i < spin_count; i += 1) spins[i] = initial;

    const double dtg = dt * kGamma / kMuB / (1.0 + damping * damping);
    for (int step = 0; step < steps; step += 1) {
        effective_field(spins, spin_count, field, exchange, field_now);
        for (int i = 0; i < spin_count; i += 1) {
            const Vec3 a = virtual_field(spins[i], field_now[i], dtg, damping);
            predictor[i] = add(spins[i], scale(cross(spins[i], a), -1.0));
            if (!normalize(predictor[i])) return { 0, 0, 0, 0, 0, 0, 0 };
        }
        effective_field(predictor, spin_count, field, exchange, field_pred);
        for (int i = 0; i < spin_count; i += 1) {
            const Vec3 a = virtual_field(spins[i], field_now[i], dtg, damping);
            const Vec3 ap = virtual_field(predictor[i], field_pred[i], dtg, damping);
            const Vec3 first = scale(cross(spins[i], a), -1.0);
            const Vec3 second = scale(cross(predictor[i], ap), -1.0);
            spins[i] = add(spins[i], add(scale(first, 0.5), scale(second, 0.5)));
            if (!normalize(spins[i])) return { 0, 0, 0, 0, 0, 0, 0 };
        }
    }

    Vec3 magnetization = { 0, 0, 0 };
    double spin_norm = 0.0;
    for (int i = 0; i < spin_count; i += 1) {
        magnetization = add(magnetization, spins[i]);
        spin_norm += norm(spins[i]);
    }
    magnetization = scale(magnetization, 1.0 / static_cast<double>(spin_count));
    spin_norm /= static_cast<double>(spin_count);
    const double energy = energy_of(spins, spin_count, field, exchange);
    if (!finite(magnetization.x) || !finite(magnetization.y) || !finite(magnetization.z) || !finite(energy) || !finite(spin_norm)) {
        return { 0, 0, 0, 0, 0, 0, 0 };
    }
    return { 1, magnetization.x, magnetization.y, magnetization.z, energy, dt * steps, spin_norm };
}

} // namespace

extern "C" int spirit_llg_status(
    int spin_count, double damping, double dt, int steps,
    double bx, double by, double bz, double exchange, double sx, double sy, double sz) {
    return solve(spin_count, damping, dt, steps, bx, by, bz, exchange, sx, sy, sz).status;
}

extern "C" double spirit_llg_mx(
    int spin_count, double damping, double dt, int steps,
    double bx, double by, double bz, double exchange, double sx, double sy, double sz) {
    return solve(spin_count, damping, dt, steps, bx, by, bz, exchange, sx, sy, sz).mx;
}

extern "C" double spirit_llg_my(
    int spin_count, double damping, double dt, int steps,
    double bx, double by, double bz, double exchange, double sx, double sy, double sz) {
    return solve(spin_count, damping, dt, steps, bx, by, bz, exchange, sx, sy, sz).my;
}

extern "C" double spirit_llg_mz(
    int spin_count, double damping, double dt, int steps,
    double bx, double by, double bz, double exchange, double sx, double sy, double sz) {
    return solve(spin_count, damping, dt, steps, bx, by, bz, exchange, sx, sy, sz).mz;
}

extern "C" double spirit_llg_energy(
    int spin_count, double damping, double dt, int steps,
    double bx, double by, double bz, double exchange, double sx, double sy, double sz) {
    return solve(spin_count, damping, dt, steps, bx, by, bz, exchange, sx, sy, sz).energy;
}

extern "C" double spirit_llg_time(
    int spin_count, double damping, double dt, int steps,
    double bx, double by, double bz, double exchange, double sx, double sy, double sz) {
    return solve(spin_count, damping, dt, steps, bx, by, bz, exchange, sx, sy, sz).time;
}

extern "C" double spirit_llg_norm(
    int spin_count, double damping, double dt, int steps,
    double bx, double by, double bz, double exchange, double sx, double sy, double sz) {
    return solve(spin_count, damping, dt, steps, bx, by, bz, exchange, sx, sy, sz).norm;
}
