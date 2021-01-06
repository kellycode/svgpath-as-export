const gulp = require('gulp');
const uglify = require('gulp-terser');
const rename = require('gulp-rename');
const replace = require('gulp-replace');
const rollup = require('gulp-rollup');


// DEPLOY JS
const allJsFiles = './js/*.js';
const allJsDest = './min';

gulp.task('rollup', function (done) {
    gulp.src(allJsFiles)
            .pipe(rollup({
                input: './js/SvgPath.js',
                format: 'esm'
            }))
            .pipe(rename('svgpath.rollup.concat.js'))
            .pipe(gulp.dest(allJsDest))
            .pipe(rename('svgpath.rollup.min.js'))
            .pipe(uglify())
            .pipe(gulp.dest(allJsDest));

    done();
});


gulp.task('default', gulp.series('rollup'));

