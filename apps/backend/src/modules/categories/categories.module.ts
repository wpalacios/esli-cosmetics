import { Module } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { CategoriesController } from "./categories.controller";
import { ProductsModule } from "../products/products.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  providers: [CategoriesService],
  controllers: [CategoriesController],
  exports: [CategoriesService],
  imports: [ProductsModule, AuthModule],
})
export class CategoriesModule {}
