// Metro resolves image imports to an asset id that <Image source> accepts.
declare module '*.png' {
  import { ImageSourcePropType } from 'react-native';

  const source: ImageSourcePropType;
  export default source;
}
