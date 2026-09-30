import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AppController } from "./app.controller";
import { PrismaModule } from "./common/prisma/prisma.module";
import appConfig from "./config/app.config";
import jwtConfig from "./config/jwt.config";
import { AuthModule } from "./modules/auth/auth.module";
import { HybridAuthGuard } from "./modules/auth/guards/hybrid-auth.guard";
import { RolesGuard } from "./modules/auth/guards/roles.guard";
import { BranchesModule } from "./modules/branches/branches.module";
import { BrandsModule } from "./modules/brands/brands.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { CustomerPricesModule } from "./modules/customer-prices/customer-prices.module";
import { CustomerTypesModule } from "./modules/customer-types/customer-types.module";
import { DiscountCodesModule } from "./modules/discount-codes/discount-codes.module";
import { EmployeesModule } from "./modules/employees/employees.module";
import { PeopleModule } from "./modules/people/people.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { PricesModule } from "./modules/prices/prices.module";
import { ProductVariantImagesModule } from "./modules/product-variant-images/product-variant-images.module";
import { ProductVariantsModule } from "./modules/product-variants/product-variants.module";
import { ProductImagesModule } from "./modules/product-images/product-images.module";
import { ProductsModule } from "./modules/products/products.module";
import { RolesModule } from "./modules/roles/roles.module";
import { StockLevelsModule } from "./modules/stock-levels/stock-levels.module";
import { StockMovementsModule } from "./modules/stock-movements/stock-movements.module";
import { StockTransfersModule } from "./modules/stock-transfers/stock-transfers.module";
import { SuppliersModule } from "./modules/suppliers/suppliers.module";
import { UsersModule } from "./modules/users/users.module";
import { ProfileModule } from "./modules/profile/profile.module";
import { WarehousesModule } from "./modules/warehouses/warehouses.module";
import { TaxRatesModule } from "./modules/tax-rates/tax-rates.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { CashRegisterModule } from "./modules/cash-register/cash-register.module";
import { QuotesModule } from "./modules/quotes/quotes.module";
import { SupplierOrderModule } from "./modules/supplier-orders/supplier-order.module";
import { NotificationModule } from "./modules/notifications/notification.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "assets"),
      serveRoot: "/static",
      serveStaticOptions: {
        index: false,
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig],
      envFilePath: [".env.local", ".env"],
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>("jwt.secret"),
        signOptions: {
          expiresIn: configService.get<number>("jwt.expiresIn"),
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProfileModule,
    RolesModule,
    PermissionsModule,
    CategoriesModule,
    BranchesModule,
    BrandsModule,
    CustomersModule,
    CustomerPricesModule,
    CustomerTypesModule,
    DiscountCodesModule,
    SuppliersModule,
    WarehousesModule,
    PeopleModule,
    EmployeesModule,
    ProductVariantsModule,
    PricesModule,
    ProductsModule,
    ProductImagesModule,
    ProductVariantImagesModule,
    StockLevelsModule,
    StockMovementsModule,
    StockTransfersModule,
    TaxRatesModule,
    OrdersModule,
    QuotesModule,
    ReportsModule,
    CashRegisterModule,
    SupplierOrderModule,
    NotificationModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: HybridAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
