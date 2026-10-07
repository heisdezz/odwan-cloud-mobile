import { Image, type ImageSource } from 'expo-image';
import { AppModal } from '@/components/overlays/app-modal';
import tw from '@/lib/tw';
export type ImageViewerProps = { source: ImageSource | number; onClose: () => void };
export function ImageViewer({ source, onClose }: ImageViewerProps) {
  return <AppModal visible title="Image preview" onClose={onClose}><Image source={source} contentFit="contain" style={tw`w-full h-80`} /></AppModal>;
}
