'use strict';

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

export { PathParse }