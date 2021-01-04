const gulp = require('gulp');
const concat = require('gulp-concat');
const uglify = require('gulp-terser');
const rename = require('gulp-rename');


// DEPLOY JS
const allJsFiles = 'js/*.js';;

const allJsDest = './deploy/js';

gulp.task('deploy_js', function () {
    return gulp.src(allJsFiles)
            .pipe(concat('svgpath.bundle.js'))
            //.pipe(gulp.dest(allJsDest))
            .pipe(rename('svgpath.min.js'))
            .pipe(uglify())
            .pipe(gulp.dest(allJsDest));
});

gulp.task('default', gulp.series('deploy_js'));
gulp.task('deploy', gulp.series('deploy_css', 'deploy_js', 'modules', 'img', 'icons'));

