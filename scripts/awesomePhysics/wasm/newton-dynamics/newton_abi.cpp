#include "ndWorld.h"
#include "ndBodyDynamic.h"
#include "ndBodyNotify.h"
#include "ndShapeInstance.h"
#include "ndShapeSphere.h"
#include "ndMatrix.h"

extern "C" int newton_version() {
    return D_NEWTON_ENGINE_MAJOR_VERSION * 100 + D_NEWTON_ENGINE_MINOR_VERSION;
}

extern "C" float newton_step() {
    ndWorld world;
    world.SetSubSteps(1);

    ndBodyDynamic* const body = new ndBodyDynamic();
    body->SetNotifyCallback(new ndBodyNotify(ndVector(0.0f, -10.0f, 0.0f, 0.0f)));
    ndMatrix matrix(ndGetIdentityMatrix());
    matrix.m_posit = ndVector(0.0f, 10.0f, 0.0f, 1.0f);
    body->SetMatrix(matrix);

    ndShapeInstance sphere(new ndShapeSphere(1.0f));
    body->SetCollisionShape(sphere);
    body->SetMassMatrix(1.0f, sphere);
    body->SetLinearDamping(0.0f);
    body->SetAngularDamping(ndVector(0.0f));

    ndSharedPtr<ndBody> owned(body);
    world.AddBody(owned);
    world.Update(ndFloat32(1.0f) / ndFloat32(60.0f));
    world.Sync();
    return body->GetMatrix().m_posit.m_y;
}
