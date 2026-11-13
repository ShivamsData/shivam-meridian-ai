import chestXrayImg from './images/scan_chest_xray_nodule_1794567126126.jpg';
import brainMriImg from './images/scan_brain_mri_axial_1794567127002.jpg';
import chestCtImg from './images/scan_chest_ct_oncology_1794567127835.jpg';
import histoSlideImg from './images/slide_histopathology_he_1794567128179.jpg';

export const CLINICAL_ASSET_MAP: Record<string, string> = {
  '/assets/scans/chest_xray_nodule.jpg': chestXrayImg,
  '/assets/scans/brain_mri_axial.jpg': brainMriImg,
  '/assets/scans/chest_ct_oncology.jpg': chestCtImg,
  '/assets/scans/slide_histopathology_he.jpg': histoSlideImg,
};

export function resolveClinicalImageSrc(imageUrl: string): string {
  return CLINICAL_ASSET_MAP[imageUrl] ?? imageUrl;
}
