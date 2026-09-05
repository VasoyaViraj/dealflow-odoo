import { SyncLoader } from 'react-spinners';

interface LoaderProps {
  loading: boolean;
  size?: number;
  color?: string;
}

export default function Loader({ loading, size = 8, color = 'var(--tw-colors-violet-500, #8b5cf6)' }: LoaderProps) {
  if (!loading) return null;
  return (
    <div className="flex justify-center items-center py-4">
      <SyncLoader color={color} loading={loading} size={size} margin={4} />
    </div>
  );
}
