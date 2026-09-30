import { CreateCategoryDto } from "./create-category.dto";

describe("CreateCategoryDtoTs", () => {
  it("should be defined", () => {
    expect(new CreateCategoryDto()).toBeDefined();
  });
});
