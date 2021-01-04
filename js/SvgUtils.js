'use strict';

import { Matrix } from './Matrix.js';

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
                        matrix.queueMatrix(params);
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

export { SvgUtils }