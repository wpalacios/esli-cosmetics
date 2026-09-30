import { Module } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";
import { CustomersModule } from "../customers/customers.module";
import { OrdersModule } from "../orders/orders.module";
import { ProductVariantsModule } from "../product-variants/product-variants.module";
import { CashRegisterModule } from "../cash-register/cash-register.module";
import { SupplierOrderModule } from "../supplier-orders/supplier-order.module";
import { SupplierOrderPdfService } from "src/common/reports/pdf/supplier-order-pdf.utils";
import { QuotesModule } from "../quotes/quotes.module";
import { PaymentsModule } from "../payments/payments.module";
import { StockTransfersModule } from "../stock-transfers/stock-transfers.module";
import { StockMovementsModule } from "../stock-movements/stock-movements.module";
import { ProductsModule } from "../products/products.module";
@Module({
  imports: [
    CustomersModule,
    OrdersModule,
    ProductVariantsModule,
    CashRegisterModule,
    SupplierOrderModule,
    QuotesModule,
    PaymentsModule,
    StockMovementsModule,
    StockTransfersModule,
    ProductsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, SupplierOrderPdfService],
  exports: [ReportsService],
})
export class ReportsModule {}
