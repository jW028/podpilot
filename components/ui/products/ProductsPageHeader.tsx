import { IoSparkles } from "react-icons/io5";
import Button from "../shared/Button";
import { Dot, Plus } from "lucide-react";

interface ProductsPageHeaderProps {
  totalProducts?: number;
  businessName?: string;
  businessId?: string;
  handleCreateProduct?: () => Promise<void>;
}

const ProductsPageHeader = ({
  totalProducts,
  businessName,
  handleCreateProduct,
}: ProductsPageHeaderProps) => {
  const formattedBusinessName = businessName
    ?.toLowerCase()
    .replace(/\s+/g, "-");

  return (
    <div className="border-b border-0 border-neutral-300 flex justify-between items-center py-6 px-8">
      <div className="space-y-2">
        <h1 className="font-serif text-xl font-bold">Products</h1>
        <div className="text-xs text-neutral-500 gap-2 flex items-center justify-center">
          <p>
            {totalProducts} {totalProducts == 1 ? "product" : "products"}
          </p>
          <Dot className="h-2 w-2" />
          <p>/business/{formattedBusinessName}/products</p>
        </div>
      </div>
      <div className="flex gap-2.5">
        <Button variant="outline" size="sm">
          Filter
        </Button>
        <Button variant="secondary" size="sm" className="space-x-1.5">
          <IoSparkles /> <p>AI Generate</p>
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleCreateProduct}
          className="space-x-1.5"
        >
          <Plus className="h-3 w-3" /> <p>New Product</p>
        </Button>
      </div>
    </div>
  );
};

export default ProductsPageHeader;
