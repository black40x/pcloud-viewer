import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import inject from 'rollup-plugin-inject';

export default [{
  input: 'dist/Viewer.js',
  output: [
    {
      file: 'build/viewer.min.js',
      format: 'umd',
      name: 'PCLOUD',
    }
  ],
  plugins: [
    resolve(),
    commonjs(),
    inject({
      THREE: [ 'three', '*' ]
    })
  ],
}];
