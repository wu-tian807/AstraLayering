# Character secondary physics

These are source ports, not packages imported from npm. The browser and workflow
use the same JavaScript modules. The original sources and licenses are included (trailing whitespace normalized in the D reference files).

| Source | Pinned revision | Runtime module |
| --- | --- | --- |
| [psd2live](https://github.com/tsunehimatoi/psd2live) | `24b1e87892f0051f1168058e1d60405d88a8a07c` | `psd2live/xpbd.js`, `psd2live/pendulum.js` |
| [Inochi2D v0.8.7](https://github.com/Inochi2D/inochi2d/tree/v0.8.7) | `e2235f6f29688d4013a0eec116a37ec8af8f1fb5` | `inochi2d/pendulum.js` |

The psd2live ports and distributed original sources are GPL-3.0; the Inochi2D
port and original sources are BSD-2-Clause, copyright Inochi2D Project, author
Asahi Lina. See each adjacent LICENSE. These licenses apply to the respective
derived modules; they are not relicensed by this adapter. A distributor must
also satisfy GPL obligations for any combined derivative distribution.

`PhysicsKernel.kt` implements the Cubism pendulum update. We port its bob
integration/length projection, with fixed 120 Hz inputs. Physical nodes (root plus up to three bobs) are
resampled independently of drawing contour nodes. The short hanging chain's
normalized segment X outputs drive the authored curved shape; the original illustration is not
straightened or subjected directly to gravity. Delay is normalized to 30 Hz;
attachment inputs use the authored inputGain, and mobility is expressed as a time-scaled decay from the UI response controls.
Mouse impulses are weighted by authored arc length so remeshing does not amplify
the force. Soft output angle saturation and final deformation limits are adapter
features, not changes to the upstream material model.

`xpbd.js` ports small-step integration, asymmetric distance constraints, signed
area protection, deformation-gradient rotation bending and soft goals. One pass
per small step means the upstream lambdas start at zero; the reverse second
distance sweep also starts at zero. Four substeps at 120 Hz equal sixteen per
30 Hz. Float64 interleaved arrays and Math.atan2 replace Kotlin FloatArray and
fastAtan2. Canvas Y points down. Inputs are interpolated through the small steps.
Material scaling separates stiff stretch, compliant diagonal shear/compression,
area and goal response. Gravity is zero at the authored equilibrium; wind and
moving supports cause deformation. Upstream gravity pre-stress calibration,
colliders, welds and long-range attachments are not ported. The host's existing
travel, angle, compression, shear and area limits remain in force.

`inochi2d/pendulum.js` ports the nonlinear sin(angle) pendulum and RK4 integrator,
including anchor-relative bob updates. It drives rigid rotation, not stretching.
The UI frequency specifies gravity/length; optional wind and final angle limits
are adapter inputs. Parent translation transfers only the authored inputGain
fraction into bob inertia; the drawing always follows the actual pivot. At zero
gain the bob travels with its attachment. Reset clears the previous pivot as
well as bob state. The separate spring-pendulum model is not ported.

The source identity schema remains `astra-component-physics-1`; runtime behavior
is `psd2live-inochi-adapter-1`. Evidence hashes include all ports and the motion
rejection gates. Old evidence cannot approve the new runtime.
