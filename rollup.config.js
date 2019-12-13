import babel from 'rollup-plugin-babel';
import builtins from 'rollup-plugin-node-builtins';
import json from '@rollup/plugin-json';
import resolve from 'rollup-plugin-node-resolve';
import commonJS from 'rollup-plugin-commonjs'


export default {
  input: './src/index.js',
  output: {
    format: 'iife',
    file: 'public/ProseArea.js',
    name: 'ProseArea'
  },
  plugins: [
      builtins(),
      babel(),
      json(),
      resolve(),
      commonJS({
        include: 'node_modules/**'
      })
    ],
};

