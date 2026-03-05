import { Loader } from "lucide-react";

const PageLoader = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center h-screen w-screen">
      <Loader className="animate-spin fill-orange-400" size={48} />
    </div>
  );
};

export default PageLoader;
