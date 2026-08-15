import autoprefixer from 'autoprefixer';

export default {
  plugins: [autoprefixer({ overrideBrowserslist: ['last 4 versions'] })],
};
