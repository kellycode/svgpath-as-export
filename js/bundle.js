const TAU = Math.PI * 2;

class A2C {
    
    // Convert an arc to a sequence of cubic bézier curves
    static arcToBezierCurves(x1, y1, x2, y2, fa, fs, rx, ry, phi) {
        
        const sin_phi = Math.sin(phi * TAU / 360);
        const cos_phi = Math.cos(phi * TAU / 360);
        
        // Make sure radii are valid
        let x1p = cos_phi * (x1 - x2) / 2 + sin_phi * (y1 - y2) / 2;
        let y1p = -sin_phi * (x1 - x2) / 2 + cos_phi * (y1 - y2) / 2;
        if (x1p === 0 && y1p === 0) {
            // we're asked to draw line to itself
            return [];
        }

        if (rx === 0 || ry === 0) {
            // one of the radii is zero
            return [];
        }

        // Compensate out-of-range radii
        rx = Math.abs(rx);
        ry = Math.abs(ry);
        
        let lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
        if (lambda > 1) {
            rx *= Math.sqrt(lambda);
            ry *= Math.sqrt(lambda);
        }

        // Get center parameters (cx, cy, theta1, delta_theta)
        let cc = this.__get_arc_center(x1, y1, x2, y2, fa, fs, rx, ry, sin_phi, cos_phi);
        let result = [];
        let theta1 = cc[2];
        let delta_theta = cc[3];

        // Split an arc to multiple segments, so each segment
        // will be less than τ/4 (= 90°)
        let segments = Math.max(Math.ceil(Math.abs(delta_theta) / (TAU / 4)), 1);

        delta_theta /= segments;

        for (let i = 0; i < segments; i++) {
            result.push(this.__approximate_unit_arc(theta1, delta_theta));
            theta1 += delta_theta;
        }

        // We have a bezier approximation of a unit circle,
        // now need to transform back to the original ellipse
        return result.map(function (curve) {
            for (let i = 0; i < curve.length; i += 2) {
                let x = curve[i + 0];
                let y = curve[i + 1];
                // scale
                x *= rx;
                y *= ry;
                // rotate
                let xp = cos_phi * x - sin_phi * y;
                let yp = sin_phi * x + cos_phi * y;
                // translate
                curve[i + 0] = xp + cc[0];
                curve[i + 1] = yp + cc[1];
            }
            return curve;
        });
    }
    
    
    // Approximate one unit arc segment with bézier curves,
    // see http://math.stackexchange.com/questions/873224
    static __approximate_unit_arc(theta1, delta_theta) {
        var alpha = 4 / 3 * Math.tan(delta_theta / 4);

        var x1 = Math.cos(theta1);
        var y1 = Math.sin(theta1);
        var x2 = Math.cos(theta1 + delta_theta);
        var y2 = Math.sin(theta1 + delta_theta);

        return [x1, y1, x1 - y1 * alpha, y1 + x1 * alpha, x2 + y2 * alpha, y2 - x2 * alpha, x2, y2];
    }
    
    
    // Calculate an angle between two unit vectors
    //
    // Since we measure angle between radii of circular arcs,
    // we can use simplified math (without length normalization)
    static __unit_vector_angle(ux, uy, vx, vy) {
        var sign = (ux * vy - uy * vx < 0) ? -1 : 1;
        var dot = ux * vx + uy * vy;
        // Add this to work with arbitrary vectors:
        // dot /= Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);

        // rounding errors, e.g. -1.0000000000000002 can screw up this
        if (dot > 1.0) {
            dot = 1.0;
        }
        if (dot < -1.0) {
            dot = -1.0;
        }

        return sign * Math.acos(dot);
    }
    
    
    // Convert from endpoint to center parameterization,
    // see http://www.w3.org/TR/SVG11/implnote.html#ArcImplementationNotes
    //
    // Return [cx, cy, theta1, delta_theta]
    //
    static __get_arc_center(x1, y1, x2, y2, fa, fs, rx, ry, sin_phi, cos_phi) {
        // Step 1.
        //
        // Moving an ellipse so origin will be the middlepoint between our two
        // points. After that, rotate it to line up ellipse axes with coordinate
        // axes.
        //
        var x1p = cos_phi * (x1 - x2) / 2 + sin_phi * (y1 - y2) / 2;
        var y1p = -sin_phi * (x1 - x2) / 2 + cos_phi * (y1 - y2) / 2;

        var rx_sq = rx * rx;
        var ry_sq = ry * ry;
        var x1p_sq = x1p * x1p;
        var y1p_sq = y1p * y1p;

        // Step 2.
        //
        // Compute coordinates of the centre of this ellipse (cx', cy')
        // in the new coordinate system.
        //
        var radicant = (rx_sq * ry_sq) - (rx_sq * y1p_sq) - (ry_sq * x1p_sq);

        if (radicant < 0) {
            // due to rounding errors it might be e.g. -1.3877787807814457e-17
            radicant = 0;
        }

        radicant /= (rx_sq * y1p_sq) + (ry_sq * x1p_sq);
        radicant = Math.sqrt(radicant) * (fa === fs ? -1 : 1);

        var cxp = radicant * rx / ry * y1p;
        var cyp = radicant * -ry / rx * x1p;

        // Step 3.
        //
        // Transform back to get centre coordinates (cx, cy) in the original
        // coordinate system.
        //
        var cx = cos_phi * cxp - sin_phi * cyp + (x1 + x2) / 2;
        var cy = sin_phi * cxp + cos_phi * cyp + (y1 + y2) / 2;

        // Step 4.
        //
        // Compute angles (theta1, delta_theta).
        //
        var v1x = (x1p - cxp) / rx;
        var v1y = (y1p - cyp) / ry;
        var v2x = (-x1p - cxp) / rx;
        var v2y = (-y1p - cyp) / ry;

        var theta1 = this.__unit_vector_angle(1, 0, v1x, v1y);
        var delta_theta = this.__unit_vector_angle(v1x, v1y, v2x, v2y);

        if (fs === 0 && delta_theta > 0) {
            delta_theta -= TAU;
        }
        if (fs === 1 && delta_theta < 0) {
            delta_theta += TAU;
        }

        return [cx, cy, theta1, delta_theta];
    }

}

// The precision used to consider an ellipse as a circle
const EPSILON = 0.0000000001;

// To convert degree in radians
const TORAD = Math.PI / 180;

// an ellipse centred at 0 with radii rx,ry and x - axis - angle ax.
class Ellipse {
    
    constructor(rx, ry, ax) {
        this.rx = rx;
        this.ry = ry;
        this.ax = ax;
    }

    // Apply a linear transform m to the ellipse
    // m is an array representing a matrix :
    //    -         -
    //   | m[0] m[2] |
    //   | m[1] m[3] |
    //    -         -
    transform(m) {
        // We consider the current ellipse as image of the unit circle
        // by first scale(rx,ry) and then rotate(ax) ...
        // So we apply ma =  m x rotate(ax) x scale(rx,ry) to the unit circle.
        var c = Math.cos(this.ax * TORAD), s = Math.sin(this.ax * TORAD);
        var ma = [
            this.rx * (m[0] * c + m[2] * s),
            this.rx * (m[1] * c + m[3] * s),
            this.ry * (-m[0] * s + m[2] * c),
            this.ry * (-m[1] * s + m[3] * c)
        ];

        // ma * transpose(ma) = [ J L ]
        //                      [ L K ]
        // L is calculated later (if the image is not a circle)
        var J = ma[0] * ma[0] + ma[2] * ma[2],
                K = ma[1] * ma[1] + ma[3] * ma[3];

        // the discriminant of the characteristic polynomial of ma * transpose(ma)
        var D = ((ma[0] - ma[3]) * (ma[0] - ma[3]) + (ma[2] + ma[1]) * (ma[2] + ma[1])) *
                ((ma[0] + ma[3]) * (ma[0] + ma[3]) + (ma[2] - ma[1]) * (ma[2] - ma[1]));

        // the "mean eigenvalue"
        var JK = (J + K) / 2;

        // check if the image is (almost) a circle
        if (D < EPSILON * JK) {
            // if it is
            this.rx = this.ry = Math.sqrt(JK);
            this.ax = 0;
            return this;
        }

        // if it is not a circle
        var L = ma[0] * ma[1] + ma[2] * ma[3];

        D = Math.sqrt(D);

        // {l1,l2} = the two eigen values of ma * transpose(ma)
        var l1 = JK + D / 2,
                l2 = JK - D / 2;
        // the x - axis - rotation angle is the argument of the l1 - eigenvector
        /*eslint-disable indent*/
        this.ax = (Math.abs(L) < EPSILON && Math.abs(l1 - K) < EPSILON) ?
                90
                :
                Math.atan(Math.abs(L) > Math.abs(l1 - K) ?
                        (l1 - J) / L
                        :
                        L / (l1 - K)
                        ) * 180 / Math.PI;
        /*eslint-enable indent*/

        // if ax > 0 => rx = sqrt(l1), ry = sqrt(l2), else exchange axes and ax += 90
        if (this.ax >= 0) {
            // if ax in [0,90]
            this.rx = Math.sqrt(l1);
            this.ry = Math.sqrt(l2);
        }
        else {
            // if ax in ]-90,0[ => exchange axes
            this.ax += 90;
            this.rx = Math.sqrt(l2);
            this.ry = Math.sqrt(l1);
        }

        return this;
    }

    // Check if the ellipse is (almost) degenerate, i.e. rx = 0 or ry = 0
    isDegenerate() {
        return (this.rx < EPSILON * this.ry || this.ry < EPSILON * this.rx);
    }
}

// combine 2 matrixes
// m1, m2 - [a, b, c, d, e, g]
function combine(m1, m2) {
    return [
        m1[0] * m2[0] + m1[2] * m2[1],
        m1[1] * m2[0] + m1[3] * m2[1],
        m1[0] * m2[2] + m1[2] * m2[3],
        m1[1] * m2[2] + m1[3] * m2[3],
        m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
        m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
    ];
}


function Matrix(request) {

    if (!(this instanceof Matrix)) {
        console.log('new matrix ' + request);
        return new Matrix();
    }
    this.queue = [];   // list of matrixes to apply
    this.cache = null; // combined matrix cache
}


Matrix.prototype.matrix = function (m) {
    if (m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0) {
        return this;
    }
    this.cache = null;
    this.queue.push(m);
    return this;
};


Matrix.prototype.translate = function (tx, ty) {
    if (tx !== 0 || ty !== 0) {
        this.cache = null;
        this.queue.push([1, 0, 0, 1, tx, ty]);
    }
    return this;
};


Matrix.prototype.scale = function (sx, sy) {
    if (sx !== 1 || sy !== 1) {
        this.cache = null;
        this.queue.push([sx, 0, 0, sy, 0, 0]);
    }
    return this;
};


Matrix.prototype.rotate = function (angle, rx, ry) {
    var rad, cos, sin;

    if (angle !== 0) {
        this.translate(rx, ry);

        rad = angle * Math.PI / 180;
        cos = Math.cos(rad);
        sin = Math.sin(rad);

        this.queue.push([cos, sin, -sin, cos, 0, 0]);
        this.cache = null;

        this.translate(-rx, -ry);
    }
    return this;
};


Matrix.prototype.skewX = function (angle) {
    if (angle !== 0) {
        this.cache = null;
        this.queue.push([1, 0, Math.tan(angle * Math.PI / 180), 1, 0, 0]);
    }
    return this;
};


Matrix.prototype.skewY = function (angle) {
    if (angle !== 0) {
        this.cache = null;
        this.queue.push([1, Math.tan(angle * Math.PI / 180), 0, 1, 0, 0]);
    }
    return this;
};


// Flatten queue
Matrix.prototype.toArray = function () {
    if (this.cache) {
        return this.cache;
    }

    if (!this.queue.length) {
        this.cache = [1, 0, 0, 1, 0, 0];
        return this.cache;
    }

    this.cache = this.queue[0];

    if (this.queue.length === 1) {
        return this.cache;
    }

    for (var i = 1; i < this.queue.length; i++) {
        this.cache = combine(this.cache, this.queue[i]);
    }

    return this.cache;
};


// Apply list of matrixes to (x,y) point.
// If `isRelative` set, `translate` component of matrix will be skipped
//
Matrix.prototype.calc = function (x, y, isRelative) {
    var m;

    // Don't change point on empty transforms queue
    if (!this.queue.length) {
        return [x, y];
    }

    // Calculate final matrix, if not exists
    //
    // NB. if you deside to apply transforms to point one-by-one,
    // they should be taken in reverse order

    if (!this.cache) {
        this.cache = this.toArray();
    }

    m = this.cache;

    // Apply matrix to point
    return [
        x * m[0] + y * m[2] + (isRelative ? 0 : m[4]),
        x * m[1] + y * m[3] + (isRelative ? 0 : m[5])
    ];
};

const OPERATIONS = {
    matrix: true,
    scale: true,
    rotate: true,
    translate: true,
    skewX: true,
    skewY: true
};

const CMD_SPLIT_RE = /\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(\s*(.+?)\s*\)[\s,]*/;
const PARAMS_SPLIT_RE = /[\s,]+/;

class SvgUtils {

    static transformParse(transformString) {
        
        let matrix = new Matrix();
        let cmd, params;

        // Split value into ['', 'translate', '10 50', '', 'scale', '2', '', 'rotate',  '-45', '']
        transformString.split(CMD_SPLIT_RE).forEach(function (item) {

            // Skip empty elements
            if (!item.length) {
                return;
            }

            // remember operation
            if (typeof OPERATIONS[item] !== 'undefined') {
                cmd = item;
                return;
            }

            // extract params & att operation to matrix
            params = item.split(PARAMS_SPLIT_RE).map(function (i) {
                return +i || 0;
            });

            // If params count is not correct - ignore command
            switch (cmd) {
                case 'matrix':
                    if (params.length === 6) {
                        matrix.matrix(params);
                    }
                    return;

                case 'scale':
                    if (params.length === 1) {
                        matrix.scale(params[0], params[0]);
                    }
                    else if (params.length === 2) {
                        matrix.scale(params[0], params[1]);
                    }
                    return;

                case 'rotate':
                    if (params.length === 1) {
                        matrix.rotate(params[0], 0, 0);
                    }
                    else if (params.length === 3) {
                        matrix.rotate(params[0], params[1], params[2]);
                    }
                    return;

                case 'translate':
                    if (params.length === 1) {
                        matrix.translate(params[0], 0);
                    }
                    else if (params.length === 2) {
                        matrix.translate(params[0], params[1]);
                    }
                    return;

                case 'skewX':
                    if (params.length === 1) {
                        matrix.skewX(params[0]);
                    }
                    return;

                case 'skewY':
                    if (params.length === 1) {
                        matrix.skewY(params[0]);
                    }
                    return;
            }
        });

        return matrix;
    }
}

const PARAM_COUNTS = {a: 7, c: 6, h: 1, l: 2, m: 2, r: 4, q: 4, s: 4, t: 2, v: 1, z: 0};

const SPECIAL_SPACES = [
    0x1680, 0x180E, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006,
    0x2007, 0x2008, 0x2009, 0x200A, 0x202F, 0x205F, 0x3000, 0xFEFF
];

class State {
    constructor(path) {
        this.index = 0;
        this.path = path;
        this.max = path.length;
        this.result = [];
        this.param = 0.0;
        this.err = '';
        this.segmentStart = 0;
        this.data = [];
    }
}

class PathParse {
    /* Returns array of segments:
     * [
     *   [ command, coord1, coord2, ... ]
     * ]
     */
    static parse(svgPath) {
        var state = new State(svgPath);
        var max = state.max;

        this.skipSpaces(state);

        while (state.index < max && !state.err.length) {
            this.scanSegment(state);
        }

        if (state.err.length) {
            state.result = [];

        }
        else if (state.result.length) {

            if ('mM'.indexOf(state.result[0][0]) < 0) {
                state.err = 'SvgPath: string should start with `M` or `m`';
                state.result = [];
            }
            else {
                state.result[0][0] = 'M';
            }
        }

        return {
            err: state.err,
            segments: state.result
        };
    }

    static isSpace(ch) {
        return (ch === 0x0A) || (ch === 0x0D) || (ch === 0x2028) || (ch === 0x2029) || (ch === 0x20) || (ch === 0x09) || (ch === 0x0B) || (ch === 0x0C) || (ch === 0xA0) || (ch >= 0x1680 && (SPECIAL_SPACES.indexOf(ch) >= 0));
    }

    static isCommand(code) {
        /*eslint-disable no-bitwise*/
        switch (code | 0x20) {
            case 0x6D/* m */:
            case 0x7A/* z */:
            case 0x6C/* l */:
            case 0x68/* h */:
            case 0x76/* v */:
            case 0x63/* c */:
            case 0x73/* s */:
            case 0x71/* q */:
            case 0x74/* t */:
            case 0x61/* a */:
            case 0x72/* r */:
                return true;
        }
        return false;
    }

    static isArc(code) {
        return (code | 0x20) === 0x61;
    }

    static isDigit(code) {
        return (code >= 48 && code <= 57);   // 0..9
    }

    static isDigitStart(code) {
        return (code >= 48 && code <= 57) || /* 0..9 */
                code === 0x2B || /* + */
                code === 0x2D || /* - */
                code === 0x2E;   /* . */
    }

    static skipSpaces(state) {
        while (state.index < state.max && this.isSpace(state.path.charCodeAt(state.index))) {
            state.index++;
        }
    }

    static scanFlag(state) {
        var ch = state.path.charCodeAt(state.index);

        if (ch === 0x30/* 0 */) {
            state.param = 0;
            state.index++;
            return;
        }

        if (ch === 0x31/* 1 */) {
            state.param = 1;
            state.index++;
            return;
        }

        state.err = 'SvgPath: arc flag can be 0 or 1 only (at pos ' + state.index + ')';
    }

    static scanParam(state) {
        var start = state.index,
                index = start,
                max = state.max,
                zeroFirst = false,
                hasCeiling = false,
                hasDecimal = false,
                hasDot = false,
                ch;

        if (index >= max) {
            state.err = 'SvgPath: missed param (at pos ' + index + ')';
            return;
        }
        ch = state.path.charCodeAt(index);

        if (ch === 0x2B/* + */ || ch === 0x2D/* - */) {
            index++;
            ch = (index < max) ? state.path.charCodeAt(index) : 0;
        }

        // This logic is shamelessly borrowed from Esprima
        // https://github.com/ariya/esprimas
        //
        if (!this.isDigit(ch) && ch !== 0x2E/* . */) {
            state.err = 'SvgPath: param should start with 0..9 or `.` (at pos ' + index + ')';
            return;
        }

        if (ch !== 0x2E/* . */) {
            zeroFirst = (ch === 0x30/* 0 */);
            index++;

            ch = (index < max) ? state.path.charCodeAt(index) : 0;

            if (zeroFirst && index < max) {
                // decimal number starts with '0' such as '09' is illegal.
                if (ch && this.isDigit(ch)) {
                    state.err = 'SvgPath: numbers started with `0` such as `09` are illegal (at pos ' + start + ')';
                    return;
                }
            }

            while (index < max && this.isDigit(state.path.charCodeAt(index))) {
                index++;
                hasCeiling = true;
            }
            ch = (index < max) ? state.path.charCodeAt(index) : 0;
        }

        if (ch === 0x2E/* . */) {
            hasDot = true;
            index++;
            while (this.isDigit(state.path.charCodeAt(index))) {
                index++;
                hasDecimal = true;
            }
            ch = (index < max) ? state.path.charCodeAt(index) : 0;
        }

        if (ch === 0x65/* e */ || ch === 0x45/* E */) {
            if (hasDot && !hasCeiling && !hasDecimal) {
                state.err = 'SvgPath: invalid float exponent (at pos ' + index + ')';
                return;
            }

            index++;

            ch = (index < max) ? state.path.charCodeAt(index) : 0;
            if (ch === 0x2B/* + */ || ch === 0x2D/* - */) {
                index++;
            }
            if (index < max && this.isDigit(state.path.charCodeAt(index))) {
                while (index < max && this.isDigit(state.path.charCodeAt(index))) {
                    index++;
                }
            }
            else {
                state.err = 'SvgPath: invalid float exponent (at pos ' + index + ')';
                return;
            }
        }

        state.index = index;
        state.param = parseFloat(state.path.slice(start, index)) + 0.0;
    }

    static finalizeSegment(state) {
        var cmd, cmdLC;

        // Process duplicated commands (without comand name)

        // This logic is shamelessly borrowed from Raphael
        // https://github.com/DmitryBaranovskiy/raphael/
        //
        cmd = state.path[state.segmentStart];
        cmdLC = cmd.toLowerCase();

        var params = state.data;

        if (cmdLC === 'm' && params.length > 2) {
            state.result.push([cmd, params[0], params[1]]);
            params = params.slice(2);
            cmdLC = 'l';
            cmd = (cmd === 'm') ? 'l' : 'L';
        }

        if (cmdLC === 'r') {
            state.result.push([cmd].concat(params));
        }
        else {

            while (params.length >= PARAM_COUNTS[cmdLC]) {
                state.result.push([cmd].concat(params.splice(0, PARAM_COUNTS[cmdLC])));
                if (!PARAM_COUNTS[cmdLC]) {
                    break;
                }
            }
        }
    }

    static scanSegment(state) {
        var max = state.max,
                cmdCode, is_arc, comma_found, need_params, i;

        state.segmentStart = state.index;
        cmdCode = state.path.charCodeAt(state.index);
        is_arc = this.isArc(cmdCode);

        if (!this.isCommand(cmdCode)) {
            state.err = 'SvgPath: bad command ' + state.path[state.index] + ' (at pos ' + state.index + ')';
            return;
        }

        need_params = PARAM_COUNTS[state.path[state.index].toLowerCase()];

        state.index++;
        this.skipSpaces(state);

        state.data = [];

        if (!need_params) {
            // Z
            this.finalizeSegment(state);
            return;
        }

        comma_found = false;

        for (; ; ) {
            for (i = need_params; i > 0; i--) {
                if (is_arc && (i === 3 || i === 4))
                    this.scanFlag(state);
                else
                    this.scanParam(state);

                if (state.err.length) {
                    return;
                }
                state.data.push(state.param);

                this.skipSpaces(state);
                comma_found = false;

                if (state.index < max && state.path.charCodeAt(state.index) === 0x2C/* , */) {
                    state.index++;
                    this.skipSpaces(state);
                    comma_found = true;
                }
            }

            // after ',' param is mandatory
            if (comma_found) {
                continue;
            }

            if (state.index >= state.max) {
                break;
            }

            // Stop on next segment
            if (!this.isDigitStart(state.path.charCodeAt(state.index))) {
                break;
            }
        }

        this.finalizeSegment(state);
    }
}

// 'class' constructor
/**
 * 
 * @param {string} path
 * @returns {SvgPath}
 */
function SvgPath(path) {
    if (!(this instanceof SvgPath))
    {
        return new SvgPath(path);
    }

    let pstate = PathParse.parse(path);

    // array of path segments.
    // each segment is array [command, param1, param2, ...]
    this.segments = pstate.segments;

    // Error message on parse error.
    this.err = pstate.err;

    // Transforms stack for lazy evaluation
    this.__stack = [];
}

/**
 * 
 * @param {string or SvgPath object} src
 * @returns {svgPathObject|SvgPath}
 */
SvgPath.from = function (src) {
    if (typeof src === 'string') {
        return new SvgPath(src);
    }
    else if (src instanceof SvgPath) {
        // create empty object
        let svgPathObject = new SvgPath('');

        // clone properies
        svgPathObject.err = src.err;

        svgPathObject.segments = src.segments.map(function (segment) {
            return segment.slice();
        });

        svgPathObject.__stack = src.__stack.map(function (m) {
            return Matrix('from').matrix(m.toArray());
        });

        return svgPathObject;
    }
    else {
        throw new Error('SvgPath.from: invalid param type ' + src);
    }
};


SvgPath.prototype.__matrix = function (segmentMatrix) {
    var self = this, i;

    // quick exit for empty matrix
    if (!segmentMatrix.queue.length) {
        return;
    }

    this.iterate(function (s, index, x, y) {
        let point; // point as an array [x, y]
        let result;
        let name; // path command name (M,m,L,l,H,h,V,v,etc)
        let isRelative;

        switch (s[0]) {

            // Process 'assymetric' commands separately
            case 'v':
                point = segmentMatrix.calc(0, s[1], true);
                result = (point[0] === 0) ? ['v', point[1]] : ['l', point[0], point[1]];
                break;

            case 'V':
                point = segmentMatrix.calc(x, s[1], false);
                result = (point[0] === segmentMatrix.calc(x, y, false)[0]) ? ['V', point[1]] : ['L', point[0], point[1]];
                break;

            case 'h':
                point = segmentMatrix.calc(s[1], 0, true);
                result = (point[1] === 0) ? ['h', point[0]] : ['l', point[0], point[1]];
                break;

            case 'H':
                point = segmentMatrix.calc(s[1], y, false);
                result = (point[1] === segmentMatrix.calc(x, y, false)[1]) ? ['H', point[0]] : ['L', point[0], point[1]];
                break;

            case 'a':
            case 'A':
                // ARC is: ['A', rx, ry, x-axis-rotation, large-arc-flag, sweep-flag, x, y]

                // Drop segment if arc is empty (end point === start point)
                /*if ((s[0] === 'A' && s[6] === x && s[7] === y) ||
                 (s[0] === 'a' && s[6] === 0 && s[7] === 0)) {
                 return [];
                 }*/

                // Transform rx, ry and the x-axis-rotation
                var ma = segmentMatrix.toArray();
                var ellipse = new Ellipse(s[1], s[2], s[3]).transform(ma);

                // flip sweep-flag if matrix is not orientation-preserving
                if (ma[0] * ma[3] - ma[1] * ma[2] < 0) {
                    s[5] = s[5] ? '0' : '1';
                }

                // Transform end point as usual (without translation for relative notation)
                point = segmentMatrix.calc(s[6], s[7], s[0] === 'a');

                // Empty arcs can be ignored by renderer, but should not be dropped
                // to avoid collisions with `S A S` and so on. Replace with empty line.
                if ((s[0] === 'A' && s[6] === x && s[7] === y) ||
                        (s[0] === 'a' && s[6] === 0 && s[7] === 0)) {
                    result = [s[0] === 'a' ? 'l' : 'L', point[0], point[1]];
                    break;
                }

                // if the resulting ellipse is (almost) a segment ...
                if (ellipse.isDegenerate()) {
                    // replace the arc by a line
                    result = [s[0] === 'a' ? 'l' : 'L', point[0], point[1]];
                }
                else {
                    // if it is a real ellipse
                    // s[0], s[4] and s[5] are not modified
                    result = [s[0], ellipse.rx, ellipse.ry, ellipse.ax, s[4], s[5], point[0], point[1]];
                }

                break;

            case 'm':
                // edge case: The very first `m` should be processed as absolute, if happens.
                // make sense for coord shift transforms.
                isRelative = index > 0;

                p = segmentMatrix.calc(s[1], s[2], isRelative);
                result = ['m', point[0], point[1]];
                break;

            default:
                name = s[0];
                result = [name];
                isRelative = (name.toLowerCase() === name);

                // Apply transformations to the segment
                for (i = 1; i < s.length; i += 2) {
                    point = segmentMatrix.calc(s[i], s[i + 1], isRelative);
                    result.push(point[0], point[1]);
                }
        }

        self.segments[index] = result;
    }, true);
};


// apply stacked commands
SvgPath.prototype.__evaluateStack = function () {
    let m, i;

    if (!this.__stack.length) {
        return;
    }

    if (this.__stack.length === 1) {
        this.__matrix(this.__stack[0]);
        this.__stack = [];
        return;
    }

    m = Matrix('evaluate');
    i = this.__stack.length;

    while (--i >= 0) {
        m.matrix(this.__stack[i].toArray());
    }

    this.__matrix(m);
    this.__stack = [];
};


// convert processed SvgPath back to string
SvgPath.prototype.toString = function () {
    var elements = [], skipCmd, cmd;

    this.__evaluateStack();

    for (var i = 0; i < this.segments.length; i++) {
        // remove repeating commands names
        cmd = this.segments[i][0];
        skipCmd = i > 0 && cmd !== 'm' && cmd !== 'M' && cmd === this.segments[i - 1][0];
        elements = elements.concat(skipCmd ? this.segments[i].slice(1) : this.segments[i]);
    }

    return elements.join(' ')
            // Optimizations: remove spaces around commands & before `-`
            //
            // We could also remove leading zeros for `0.5`-like values,
            // but their count is too small to spend time on
            .replace(/ ?([achlmqrstvz]) ?/gi, '$1')
            .replace(/ \-/g, '-')
            // workaround for FontForge SVG importing bug
            .replace(/zm/g, 'z m');
};


// translate path to (x [, y])
SvgPath.prototype.translate = function (x, y) {
    this.__stack.push(Matrix('translate').translate(x, y || 0));
    return this;
};


// scale path to (sx [, sy])
// sy = sx if not defined
SvgPath.prototype.scale = function (sx, sy) {
    this.__stack.push(Matrix('scale').scale(sx, (!sy && (sy !== 0)) ? sx : sy));
    return this;
};


// rotate path around point (sx [, sy])
// sy = sx if not defined
SvgPath.prototype.rotate = function (angle, rx, ry) {
    this.__stack.push(Matrix('rotate').rotate(angle, rx || 0, ry || 0));
    return this;
};


// skew path along the X axis by `degrees` angle
SvgPath.prototype.skewX = function (degrees) {
    this.__stack.push(Matrix('skewX').skewX(degrees));
    return this;
};


// skew path along the Y axis by `degrees` angle
SvgPath.prototype.skewY = function (degrees) {
    this.__stack.push(Matrix('skewY').skewY(degrees));
    return this;
};


// apply matrix transform (array of 6 elements)
SvgPath.prototype.matrix = function (m) {
    this.__stack.push(Matrix('matrix').matrix(m));
    return this;
};


// transform path according to "transform" attr of SVG spec
SvgPath.prototype.transform = function (transformString) {
    if (!transformString.trim()) {
        return this;
    }
    this.__stack.push(SvgUtils.transformParse(transformString));
    return this;
};


// round coords with given decimal precition.
// 0 by default (to integers)
SvgPath.prototype.round = function (d) {
    var contourStartDeltaX = 0, contourStartDeltaY = 0, deltaX = 0, deltaY = 0, l;

    d = d || 0;

    this.__evaluateStack();

    this.segments.forEach(function (s) {
        var isRelative = (s[0].toLowerCase() === s[0]);

        switch (s[0]) {
            case 'H':
            case 'h':
                if (isRelative) {
                    s[1] += deltaX;
                }
                deltaX = s[1] - s[1].toFixed(d);
                s[1] = +s[1].toFixed(d);
                return;

            case 'V':
            case 'v':
                if (isRelative) {
                    s[1] += deltaY;
                }
                deltaY = s[1] - s[1].toFixed(d);
                s[1] = +s[1].toFixed(d);
                return;

            case 'Z':
            case 'z':
                deltaX = contourStartDeltaX;
                deltaY = contourStartDeltaY;
                return;

            case 'M':
            case 'm':
                if (isRelative) {
                    s[1] += deltaX;
                    s[2] += deltaY;
                }

                deltaX = s[1] - s[1].toFixed(d);
                deltaY = s[2] - s[2].toFixed(d);

                contourStartDeltaX = deltaX;
                contourStartDeltaY = deltaY;

                s[1] = +s[1].toFixed(d);
                s[2] = +s[2].toFixed(d);
                return;

            case 'A':
            case 'a':
                // [cmd, rx, ry, x-axis-rotation, large-arc-flag, sweep-flag, x, y]
                if (isRelative) {
                    s[6] += deltaX;
                    s[7] += deltaY;
                }

                deltaX = s[6] - s[6].toFixed(d);
                deltaY = s[7] - s[7].toFixed(d);

                s[1] = +s[1].toFixed(d);
                s[2] = +s[2].toFixed(d);
                s[3] = +s[3].toFixed(d + 2); // better precision for rotation
                s[6] = +s[6].toFixed(d);
                s[7] = +s[7].toFixed(d);
                return;

            default:
                // a c l q s t
                l = s.length;

                if (isRelative) {
                    s[l - 2] += deltaX;
                    s[l - 1] += deltaY;
                }

                deltaX = s[l - 2] - s[l - 2].toFixed(d);
                deltaY = s[l - 1] - s[l - 1].toFixed(d);

                s.forEach(function (val, i) {
                    if (!i) {
                        return;
                    }
                    s[i] = +s[i].toFixed(d);
                });
                return;
        }
    });

    return this;
};


// apply iterator function to all segments. If function returns result,
// current segment will be replaced to array of returned segments.
// if empty array is returned, current regment will be deleted.
SvgPath.prototype.iterate = function (iterator, keepLazyStack) {
    var segments = this.segments,
            replacements = {},
            needReplace = false,
            lastX = 0,
            lastY = 0,
            countourStartX = 0,
            countourStartY = 0;
    var i, j, newSegments;

    if (!keepLazyStack) {
        this.__evaluateStack();
    }

    segments.forEach(function (s, index) {

        var res = iterator(s, index, lastX, lastY);

        if (Array.isArray(res)) {
            replacements[index] = res;
            needReplace = true;
        }

        var isRelative = (s[0] === s[0].toLowerCase());

        // calculate absolute X and Y
        switch (s[0]) {
            case 'm':
            case 'M':
                lastX = s[1] + (isRelative ? lastX : 0);
                lastY = s[2] + (isRelative ? lastY : 0);
                countourStartX = lastX;
                countourStartY = lastY;
                return;

            case 'h':
            case 'H':
                lastX = s[1] + (isRelative ? lastX : 0);
                return;

            case 'v':
            case 'V':
                lastY = s[1] + (isRelative ? lastY : 0);
                return;

            case 'z':
            case 'Z':
                // That make sence for multiple contours
                lastX = countourStartX;
                lastY = countourStartY;
                return;

            default:
                lastX = s[s.length - 2] + (isRelative ? lastX : 0);
                lastY = s[s.length - 1] + (isRelative ? lastY : 0);
        }
    });

    // replace segments if iterator return results
    if (!needReplace) {
        return this;
    }

    newSegments = [];

    for (i = 0; i < segments.length; i++) {
        if (typeof replacements[i] !== 'undefined') {
            for (j = 0; j < replacements[i].length; j++) {
                newSegments.push(replacements[i][j]);
            }
        }
        else {
            newSegments.push(segments[i]);
        }
    }

    this.segments = newSegments;

    return this;
};


// converts segments from relative to absolute
SvgPath.prototype.abs = function () {

    this.iterate(function (s, index, x, y) {
        var name = s[0],
                nameUC = name.toUpperCase(),
                i;

        // Skip absolute commands
        if (name === nameUC) {
            return;
        }

        s[0] = nameUC;

        switch (name) {
            case 'v':
                // v has shifted coords parity
                s[1] += y;
                return;

            case 'a':
                // ARC is: ['A', rx, ry, x-axis-rotation, large-arc-flag, sweep-flag, x, y]
                // touch x, y only
                s[6] += x;
                s[7] += y;
                return;

            default:
            for (i = 1; i < s.length; i++) {
                s[i] += i % 2 ? x : y; // odd values are X, even - Y
            }
        }
    }, true);

    return this;
};


// converts segments from absolute to relative
SvgPath.prototype.rel = function () {

    this.iterate(function (s, index, x, y) {
        var name = s[0],
                nameLC = name.toLowerCase(),
                i;

        // Skip relative commands
        if (name === nameLC) {
            return;
        }

        // Don't touch the first M to avoid potential confusions.
        if (index === 0 && name === 'M') {
            return;
        }

        s[0] = nameLC;

        switch (name) {
            case 'V':
                // V has shifted coords parity
                s[1] -= y;
                return;

            case 'A':
                // ARC is: ['A', rx, ry, x-axis-rotation, large-arc-flag, sweep-flag, x, y]
                // touch x, y only
                s[6] -= x;
                s[7] -= y;
                return;

            default:
            for (i = 1; i < s.length; i++) {
                s[i] -= i % 2 ? x : y; // odd values are X, even - Y
            }
        }
    }, true);

    return this;
};


// converts arcs to cubic bézier curves
SvgPath.prototype.unarc = function () {
    this.iterate(function (s, index, x, y) {
        var new_segments, nextX, nextY, result = [], name = s[0];

        // Skip anything except arcs
        if (name !== 'A' && name !== 'a') {
            return null;
        }

        if (name === 'a') {
            // convert relative arc coordinates to absolute
            nextX = x + s[6];
            nextY = y + s[7];
        }
        else {
            nextX = s[6];
            nextY = s[7];
        }

        new_segments = A2C.arcToBezierCurves(x, y, nextX, nextY, s[4], s[5], s[1], s[2], s[3]);

        // Degenerated arcs can be ignored by renderer, but should not be dropped
        // to avoid collisions with `S A S` and so on. Replace with empty line.
        if (new_segments.length === 0) {
            return [[s[0] === 'a' ? 'l' : 'L', s[6], s[7]]];
        }

        new_segments.forEach(function (s) {
            result.push(['C', s[2], s[3], s[4], s[5], s[6], s[7]]);
        });

        return result;
    });

    return this;
};


// converts smooth curves (with missed control point) to generic curves
SvgPath.prototype.unshort = function () {
    var segments = this.segments;
    var prevControlX, prevControlY, prevSegment;
    var curControlX, curControlY;

    // TODO: add lazy evaluation flag when relative commands supported

    this.iterate(function (s, idx, x, y) {
        var name = s[0], nameUC = name.toUpperCase(), isRelative;

        // First command MUST be M|m, it's safe to skip.
        // Protect from access to [-1] for sure.
        if (!idx) {
            return;
        }

        if (nameUC === 'T') { // quadratic curve
            isRelative = (name === 't');

            prevSegment = segments[idx - 1];

            if (prevSegment[0] === 'Q') {
                prevControlX = prevSegment[1] - x;
                prevControlY = prevSegment[2] - y;
            }
            else if (prevSegment[0] === 'q') {
                prevControlX = prevSegment[1] - prevSegment[3];
                prevControlY = prevSegment[2] - prevSegment[4];
            }
            else {
                prevControlX = 0;
                prevControlY = 0;
            }

            curControlX = -prevControlX;
            curControlY = -prevControlY;

            if (!isRelative) {
                curControlX += x;
                curControlY += y;
            }

            segments[idx] = [
                isRelative ? 'q' : 'Q',
                curControlX, curControlY,
                s[1], s[2]
            ];

        }
        else if (nameUC === 'S') { // cubic curve
            isRelative = (name === 's');

            prevSegment = segments[idx - 1];

            if (prevSegment[0] === 'C') {
                prevControlX = prevSegment[3] - x;
                prevControlY = prevSegment[4] - y;
            }
            else if (prevSegment[0] === 'c') {
                prevControlX = prevSegment[3] - prevSegment[5];
                prevControlY = prevSegment[4] - prevSegment[6];
            }
            else {
                prevControlX = 0;
                prevControlY = 0;
            }

            curControlX = -prevControlX;
            curControlY = -prevControlY;

            if (!isRelative) {
                curControlX += x;
                curControlY += y;
            }

            segments[idx] = [
                isRelative ? 'c' : 'C',
                curControlX, curControlY,
                s[1], s[2], s[3], s[4]
            ];
        }
    });

    return this;
};

export { SvgPath };
