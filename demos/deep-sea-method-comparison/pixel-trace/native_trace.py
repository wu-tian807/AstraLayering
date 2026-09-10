"""Optional native libpotrace acceleration; identical closed Bezier output."""
import ctypes as C
import os
import numpy as np


class Point(C.Structure):
    _fields_ = [('x', C.c_double), ('y', C.c_double)]


class Curve(C.Structure):
    _fields_ = [('n', C.c_int), ('tag', C.POINTER(C.c_int)), ('c', C.POINTER(Point * 3))]


class Path(C.Structure):
    pass


Path._fields_ = [('area', C.c_int), ('sign', C.c_int), ('curve', Curve), ('next', C.POINTER(Path)), ('childlist', C.POINTER(Path)), ('sibling', C.POINTER(Path)), ('priv', C.c_void_p)]


class State(C.Structure):
    _fields_ = [('status', C.c_int), ('plist', C.POINTER(Path)), ('priv', C.c_void_p)]


class Param(C.Structure):
    _fields_ = [('turdsize', C.c_int), ('turnpolicy', C.c_int), ('alphamax', C.c_double), ('opticurve', C.c_int), ('opttolerance', C.c_double)]


class Bitmap(C.Structure):
    _fields_ = [('w', C.c_int), ('h', C.c_int), ('dy', C.c_int), ('map', C.POINTER(C.c_ulong))]


lib = C.CDLL(os.environ.get('ASTRA_POTRACE_LIB', '/tmp/astra-potrace/lib/libpotrace.dylib'))
lib.potrace_param_default.restype = C.POINTER(Param)
lib.potrace_trace.argtypes = [C.POINTER(Param), C.POINTER(Bitmap)]
lib.potrace_trace.restype = C.POINTER(State)
lib.potrace_state_free.argtypes = [C.POINTER(State)]
lib.potrace_param_free.argtypes = [C.POINTER(Param)]


def trace(mask, ox=0, oy=0, scale=2, small=False):
    h, w = mask.shape
    words = (w + 63) // 64
    padded = np.pad(mask, ((0,0), (0, words*64-w)))
    packed = np.packbits(padded, axis=1, bitorder='big').view('>u8').astype(np.uint64)
    bm = Bitmap(w, h, words, packed.ctypes.data_as(C.POINTER(C.c_ulong)))
    param = lib.potrace_param_default()
    param.contents.turdsize = 0
    param.contents.alphamax = 1.25
    param.contents.opttolerance = .28
    state = lib.potrace_trace(param, C.byref(bm))
    if not state or state.contents.status:
        raise RuntimeError('Native contour fitting failed')
    out = []

    def point(pt):
        return f'{pt.x/scale+ox:.2f},{pt.y/scale+oy:.2f}'

    current = state.contents.plist
    while current:
        curve = current.contents.curve
        out.append('M' + point(curve.c[curve.n-1][2]))
        for i in range(curve.n):
            pts = curve.c[i]
            if curve.tag[i] == 2:
                out.append('L' + point(pts[1]) + ' ' + point(pts[2]))
            else:
                out.append('C' + point(pts[0]) + ' ' + point(pts[1]) + ' ' + point(pts[2]))
        out.append('Z')
        current = current.contents.next
    lib.potrace_state_free(state)
    lib.potrace_param_free(param)
    return ''.join(out)
