import React from 'react';
import { Appliance3DViewer } from './Appliance3DViewer';
import { ShowroomLobby3D } from './ShowroomLobby3D';

export interface HeroBannerProps {
  lang?: 'vi' | 'en';
  onExplore3DProduct?: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ lang = 'vi', onExplore3DProduct }) => {
  return <ShowroomLobby3D lang={lang} onExplore3DProduct={onExplore3DProduct} />;
};

export default HeroBanner;
