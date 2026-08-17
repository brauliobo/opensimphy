#include <math.h>

enum { GALPY_OK = 1, GALPY_FAIL = 0 };

static const double kAlpha = 1.8;
static const double kRc = 1.9 / 8.0;
static const double kDiskA = 3.0 / 8.0;
static const double kDiskB = 0.28 / 8.0;
static const double kHaloA = 2.0;
static const double kTwoPi = 6.283185307179586476925286766559;
static const double kGamma01 = 9.513507698668731836;
static const double kGamma06 = 1.4891922488128171085;
static const double kEps = 1e-12;
static const double kMaxAbs = 100.0;
static const double kMinR = 1e-8;
static const double kMaxDt = 0.1;

static int g_ready;
static double g_amp_bulge;
static double g_amp_disk;
static double g_amp_halo;
static double g_x;
static double g_y;
static double g_z;
static double g_vx;
static double g_vy;
static double g_vz;

static int finite_abs(double value) {
  return isfinite(value) && fabs(value) <= kMaxAbs;
}

static double gamma_s(double s) {
  if (s == 0.1) return kGamma01;
  return kGamma06;
}

static double regularized_gamma_p(double s, double x) {
  if (x <= 0.0) return 0.0;
  if (!isfinite(x)) return 1.0;
  const double gamma_s_value = gamma_s(s);
  if (x < s + 1.0) {
    const double log_term = s * log(x) - x - log(gamma_s_value);
    double term = exp(log_term) / s;
    double sum = term;
    for (int k = 1; k < 200; k += 1) {
      term *= x / (s + (double)k);
      sum += term;
      if (fabs(term) < 1e-18 * (1.0 + fabs(sum))) break;
    }
    if (sum < 0.0) return 0.0;
    if (sum > 1.0) return 1.0;
    return sum;
  }

  const double fpmin = 1e-30;
  double b = x + 1.0 - s;
  double c = 1.0 / fpmin;
  double d = 1.0 / b;
  double h = d;
  for (int i = 1; i <= 200; i += 1) {
    const double an = -((double)i) * (((double)i) - s);
    b += 2.0;
    d = an * d + b;
    if (fabs(d) < fpmin) d = fpmin;
    c = b + an / c;
    if (fabs(c) < fpmin) c = fpmin;
    d = 1.0 / d;
    const double del = d * c;
    h *= del;
    if (fabs(del - 1.0) < 1e-14) break;
  }
  const double upper = exp(s * log(x) - x) * h;
  double q = upper / gamma_s_value;
  if (q < 0.0) q = 0.0;
  if (q > 1.0) q = 1.0;
  return 1.0 - q;
}

static double bulge_mass_shape(double r) {
  const double s = 1.5 - 0.5 * kAlpha;
  const double x = (r / kRc) * (r / kRc);
  return kTwoPi * pow(kRc, 3.0 - kAlpha) * gamma_s(s) * regularized_gamma_p(s, x);
}

static void bulge_force_shape(double R, double z, double *fR, double *fz) {
  const double r = hypot(R, z);
  if (r < kEps) {
    *fR = 0.0;
    *fz = 0.0;
    return;
  }
  const double mass = bulge_mass_shape(r);
  const double scale = -mass / (r * r * r);
  *fR = scale * R;
  *fz = scale * z;
}

static double bulge_phi_shape(double R, double z) {
  const double r = hypot(R, z);
  if (r < kEps) return 0.0;
  const double x = (r / kRc) * (r / kRc);
  const double s0 = 1.0 - 0.5 * kAlpha;
  const double s1 = 1.5 - 0.5 * kAlpha;
  return kTwoPi * pow(kRc, 3.0 - kAlpha) * (
    regularized_gamma_p(s0, x) * gamma_s(s0) / kRc
    - regularized_gamma_p(s1, x) * gamma_s(s1) / r
  );
}

static void mn_force_shape(double R, double z, double *fR, double *fz) {
  const double zb = hypot(z, kDiskB);
  const double apzb = kDiskA + zb;
  const double s2 = R * R + apzb * apzb;
  const double s3 = s2 * sqrt(s2);
  *fR = -R / s3;
  *fz = (zb == apzb) ? -z / s3 : -z * apzb / (zb * s3);
}

static double mn_phi_shape(double R, double z) {
  const double zb = hypot(z, kDiskB);
  return -1.0 / hypot(R, kDiskA + zb);
}

static void nfw_force_shape(double R, double z, double *fR, double *fz) {
  const double r2 = R * R + z * z;
  const double r = sqrt(r2);
  if (r < kEps) {
    *fR = 0.0;
    *fz = 0.0;
    return;
  }
  const double radial = 1.0 / (r2 * (kHaloA + r)) - log(1.0 + r / kHaloA) / (r * r2);
  *fR = R * radial;
  *fz = z * radial;
}

static double nfw_phi_shape(double R, double z) {
  const double r = hypot(R, z);
  if (r < kEps) return -1.0 / kHaloA;
  return -log(1.0 + r / kHaloA) / r;
}

static void ensure_amplitudes(void) {
  if (g_ready) return;
  double fR;
  double fz;
  bulge_force_shape(1.0, 0.0, &fR, &fz);
  g_amp_bulge = -0.05 / fR;
  mn_force_shape(1.0, 0.0, &fR, &fz);
  g_amp_disk = -0.6 / fR;
  nfw_force_shape(1.0, 0.0, &fR, &fz);
  g_amp_halo = -0.35 / fR;
  g_ready = 1;
}

static void mw_force(double R, double z, double *fR, double *fz) {
  ensure_amplitudes();
  double bulge_R;
  double bulge_z;
  double disk_R;
  double disk_z;
  double halo_R;
  double halo_z;
  bulge_force_shape(R, z, &bulge_R, &bulge_z);
  mn_force_shape(R, z, &disk_R, &disk_z);
  nfw_force_shape(R, z, &halo_R, &halo_z);
  *fR = g_amp_bulge * bulge_R + g_amp_disk * disk_R + g_amp_halo * halo_R;
  *fz = g_amp_bulge * bulge_z + g_amp_disk * disk_z + g_amp_halo * halo_z;
}

static double mw_phi(double R, double z) {
  ensure_amplitudes();
  return g_amp_bulge * bulge_phi_shape(R, z)
    + g_amp_disk * mn_phi_shape(R, z)
    + g_amp_halo * nfw_phi_shape(R, z);
}

static void cartesian_force(double x, double y, double z, double *ax, double *ay, double *az) {
  const double R = hypot(x, y);
  double fR;
  double fz;
  mw_force(R, z, &fR, &fz);
  if (R < kEps) {
    *ax = 0.0;
    *ay = 0.0;
  } else {
    *ax = fR * x / R;
    *ay = fR * y / R;
  }
  *az = fz;
}

static int kick(double half_dt) {
  double ax;
  double ay;
  double az;
  cartesian_force(g_x, g_y, g_z, &ax, &ay, &az);
  if (!isfinite(ax) || !isfinite(ay) || !isfinite(az)) return GALPY_FAIL;
  g_vx += half_dt * ax;
  g_vy += half_dt * ay;
  g_vz += half_dt * az;
  return GALPY_OK;
}

int galpy_orbit_init(double R, double z, double phi, double vR, double vT, double vz) {
  if (R < kMinR || R > kMaxAbs || !finite_abs(z) || !finite_abs(phi) || !finite_abs(vR) || !finite_abs(vT) || !finite_abs(vz)) {
    return GALPY_FAIL;
  }
  const double c = cos(phi);
  const double s = sin(phi);
  g_x = R * c;
  g_y = R * s;
  g_z = z;
  g_vx = vR * c - vT * s;
  g_vy = vR * s + vT * c;
  g_vz = vz;
  ensure_amplitudes();
  return GALPY_OK;
}

int galpy_orbit_step(double dt) {
  if (!(dt > 0.0) || dt > kMaxDt || !isfinite(dt)) return GALPY_FAIL;
  if (kick(0.5 * dt) != GALPY_OK) return GALPY_FAIL;
  g_x += dt * g_vx;
  g_y += dt * g_vy;
  g_z += dt * g_vz;
  if (!finite_abs(g_x) || !finite_abs(g_y) || !finite_abs(g_z)) return GALPY_FAIL;
  return kick(0.5 * dt);
}

double galpy_orbit_R(void) { return hypot(g_x, g_y); }
double galpy_orbit_z(void) { return g_z; }
double galpy_orbit_phi(void) { return atan2(g_y, g_x); }

double galpy_orbit_vR(void) {
  const double R = hypot(g_x, g_y);
  if (R < kEps) return 0.0;
  return (g_x * g_vx + g_y * g_vy) / R;
}

double galpy_orbit_vT(void) {
  const double R = hypot(g_x, g_y);
  if (R < kEps) return 0.0;
  return (g_x * g_vy - g_y * g_vx) / R;
}

double galpy_orbit_vz(void) { return g_vz; }

double galpy_orbit_energy(void) {
  const double R = hypot(g_x, g_y);
  const double kinetic = 0.5 * (g_vx * g_vx + g_vy * g_vy + g_vz * g_vz);
  return kinetic + mw_phi(R, g_z);
}

double galpy_orbit_Lz(void) { return g_x * g_vy - g_y * g_vx; }

double galpy_rforce(double R, double z) {
  if (R < kMinR || R > kMaxAbs || !finite_abs(z)) return NAN;
  double fR;
  double fz;
  mw_force(R, z, &fR, &fz);
  return fR;
}

double galpy_zforce(double R, double z) {
  if (R < kMinR || R > kMaxAbs || !finite_abs(z)) return NAN;
  double fR;
  double fz;
  mw_force(R, z, &fR, &fz);
  return fz;
}

double galpy_circular_velocity(double R) {
  if (R < kMinR || R > kMaxAbs) return NAN;
  double fR;
  double fz;
  mw_force(R, 0.0, &fR, &fz);
  const double vc2 = -R * fR;
  if (!(vc2 >= 0.0) || !isfinite(vc2)) return NAN;
  return sqrt(vc2);
}
