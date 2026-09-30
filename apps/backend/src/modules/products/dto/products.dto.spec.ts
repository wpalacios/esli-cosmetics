import { ProductsDto } from "./products.dto";

describe("ProductsDto", () => {
  it("should be defined", () => {
    expect(new ProductsDto()).toBeDefined();
  });
});
