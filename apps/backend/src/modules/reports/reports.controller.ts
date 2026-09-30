import {
  Body,
  Controller,
  Post,
  Res,
  Get,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  Logger,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
  ApiOkResponse,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { ReportsService } from "./reports.service";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { CustomersService } from "../customers/customers.service";
import { OrdersService } from "../orders/orders.service";
import { ProductVariantsService } from "../product-variants/product-variants.service";
import { CashSessionService } from "../cash-register/cash-session.service";
import type { ReceiptPdfData } from "./types/receipt-types";
import { SupplierOrderService } from "../supplier-orders/supplier-order.service";
import { QuotesService } from "../quotes/quotes.service";
import { PaymentsService } from "../payments/payments.service";
import { StockTransfersService } from "../stock-transfers/stock-transfers.service";
import type { TransferPdfData } from "../stock-transfers/types/transfer-pdf-types";
import { StockMovementsService } from "../stock-movements/stock-movements.service";
import { ProductCatalogPdfExportDto } from "./dto/product-catalog-pdf-export.dto";

@ApiTags("Reports")
@ApiBearerAuth()
@Controller("reports")
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(
    private readonly reportsService: ReportsService,
    private readonly customersService: CustomersService,
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly productVariantsService: ProductVariantsService,
    private readonly cashSessionService: CashSessionService,
    private readonly supplierOrderService: SupplierOrderService,
    private readonly quotesService: QuotesService,
    private readonly stockTransfersService: StockTransfersService,
    private readonly stockMovementsService: StockMovementsService
  ) {}

  // customers report preview
  @Post("customers/preview")
  @Permissions("reports.export")
  @ApiOperation({ summary: "Preview customers report" })
  async previewCustomers(
    @Body() body: { search?: string; from?: string; to?: string }
  ) {
    return this.customersService.listCustomerItems({
      page: 1,
      limit: 20,
      search: body.search,
      from: body.from,
      to: body.to,
    });
  }

  // list customer items (paginated)
  @Get("customers/items")
  @Permissions("reports.export")
  @ApiOperation({ summary: "List customer items (paginated)" })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page",
  })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "from", required: false, type: String })
  @ApiQuery({ name: "to", required: false, type: String })
  async listCustomerItems(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query("search") search?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.customersService.listCustomerItems({
      page,
      limit,
      search,
      from,
      to,
    });
  }

  // customers excel report export
  @Post("customers/export/excel")
  @Permissions("reports.export")
  @ApiOperation({ summary: "Export customers report (re-fetches data)" })
  async exportCustomers(
    @Body()
    body: { search?: string; from?: string; to?: string; maxRows?: number },
    @Res() res: Response
  ) {
    const req = await this.customersService.exportCustomersReport({
      search: body.search,
      from: body.from,
      to: body.to,
      maxRows: body.maxRows,
    });

    const { fileName, buffer } =
      await this.reportsService.generateReportFromData(req);
    res.status(200);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  // sales by customer report preview
  @Post("sales/customers/preview")
  @Permissions("reports.export")
  @ApiOperation({ summary: "Preview sales by customer report" })
  async previewSalesByCustomer(
    @Body()
    body: {
      orderNumber?: string;
      from?: string;
      to?: string;
      branchId?: string;
      customerId?: string;
      employeeId?: string;
      paymentMethod?: "CASH" | "CREDIT";
      locationId?: string;
      orderStatus?: string;
    }
  ) {
    return this.customersService.listSalesByCustomerItems({
      page: 1,
      limit: 20,
      orderNumber: body.orderNumber,
      from: body.from,
      to: body.to,
      branchId: body.branchId,
      customerId: body.customerId,
      employeeId: body.employeeId,
      paymentMethod: body.paymentMethod,
      locationId: body.locationId,
      orderStatus: body.orderStatus,
    });
  }

  // sales by customer report export
  @Post("sales/customers/export/excel")
  @Permissions("reports.export")
  @ApiOperation({ summary: "Export sales by customer report (Excel)" })
  @ApiProduces(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
  @ApiOkResponse({
    description: "Excel file",
    content: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  async exportSalesByCustomer(
    @Body()
    body: {
      orderNumber?: string;
      from?: string;
      to?: string;
      branchId?: string;
      customerId?: string;
      employeeId?: string;
      paymentMethod?: "CASH" | "CREDIT";
      locationId?: string;
      orderStatus?: string;
      maxRows?: number;
    },
    @Res() res: Response
  ) {
    const req = await this.customersService.exportSalesByCustomerReport({
      orderNumber: body.orderNumber,
      from: body.from,
      to: body.to,
      branchId: body.branchId,
      customerId: body.customerId,
      employeeId: body.employeeId,
      paymentMethod: body.paymentMethod,
      locationId: body.locationId,
      orderStatus: body.orderStatus,
      maxRows: body.maxRows,
    });

    const { fileName, buffer } =
      await this.reportsService.generateReportFromData(req);
    res.status(200);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  //list sales items by customer (paginated)
  @Get("sales/customers/items")
  @Permissions("reports.export")
  @ApiOperation({ summary: "List sales items by customer (paginated)" })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page",
  })
  @ApiQuery({ name: "orderNumber", required: false, type: String })
  @ApiQuery({ name: "from", required: false, type: String })
  @ApiQuery({ name: "to", required: false, type: String })
  @ApiQuery({ name: "branchId", required: false, type: String })
  @ApiQuery({ name: "customerId", required: false, type: String })
  @ApiQuery({ name: "employeeId", required: false, type: String })
  @ApiQuery({ name: "locationId", required: false, type: String })
  @ApiQuery({ name: "orderStatus", required: false, type: String })
  @ApiQuery({ name: "paymentMethod", required: false, type: String })
  async listSalesItems(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query("orderNumber") orderNumber?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("branchId") branchId?: string,
    @Query("customerId") customerId?: string,
    @Query("employeeId") employeeId?: string,
    @Query("locationId") locationId?: string,
    @Query("orderStatus") orderStatus?: string,
    @Query("paymentMethod") paymentMethod?: "CASH" | "CREDIT"
  ) {
    const result = await this.customersService.listSalesByCustomerItems({
      page,
      limit,
      orderNumber,
      from,
      to,
      branchId,
      customerId,
      employeeId,
      locationId,
      orderStatus,
      paymentMethod,
    });
    return result;
  }

  // Customers report PDF: same layout and table as sales report; info box has Fecha desde, Fecha hasta, Fecha emisión
  @Post("customers/export/PDF")
  @Permissions("reports.export")
  async exportCustomersPdf(
    @Body()
    body: {
      search?: string;
      from?: string;
      to?: string;
      generatedAt?: string;
      generatedAtFormatted?: string;
      timeZone?: string;
      maxRows?: number;
    },
    @Res() res: Response
  ) {
    const req = await this.customersService.exportSalesByCustomerReport({
      orderNumber: body.search,
      from: body.from,
      to: body.to,
      maxRows: body.maxRows,
    });
    const { fileName, buffer } =
      await this.reportsService.generateCustomersReportPdf(req, {
        from: body.from,
        to: body.to,
        generatedAt: body.generatedAt,
        generatedAtFormatted: body.generatedAtFormatted,
        timeZone: body.timeZone,
      });
    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store, max-age=0");

    const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.send(buffer);
  }

  // sales by customer report PDF export
  @Post("sales/customers/export/PDF")
  @Permissions("reports.export")
  @ApiOperation({ summary: "Export sales by customer report (PDF)" })
  @ApiProduces("application/pdf")
  @ApiOkResponse({
    description: "PDF file",
    content: {
      "application/pdf": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  async exportSalesByCustomerPdf(
    @Body()
    body: {
      orderNumber?: string;
      from?: string;
      to?: string;
      branchId?: string;
      customerId?: string;
      employeeId?: string;
      paymentMethod?: "CASH" | "CREDIT";
      locationId?: string;
      orderStatus?: string;
      /** ISO date string - when the report is generated */
      generatedAt?: string;
      /** Pre-formatted date from user's browser for PDF footer (e.g. "14/03/2025, 10:30:00 a.m.") */
      generatedAtFormatted?: string;
      timeZone?: string;
      maxRows?: number;
    },
    @Res() res: Response
  ) {
    const req = await this.customersService.exportSalesByCustomerReport(body);
    const { fileName, buffer } =
      await this.reportsService.generateSalesByCustomerPdf(req, {
        from: body.from,
        to: body.to,
        generatedAt: body.generatedAt,
        generatedAtFormatted: body.generatedAtFormatted,
        timeZone: body.timeZone,
      });
    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store, max-age=0");

    const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.send(buffer);
  }

  // export receipt PDF
  @Post("receipt/export/pdf")
  @Permissions("reports.export")
  @ApiOperation({ summary: "Export receipt PDF by orderId" })
  @ApiProduces("application/pdf")
  @ApiOkResponse({
    description: "PDF file",
    content: {
      "application/pdf": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  async exportReceiptPdf(
    @Body() body: { orderId: string; timeZone?: string },
    @Res() res: Response
  ) {
    const receiptData: ReceiptPdfData =
      await this.ordersService.getReceiptPdfData(body.orderId);
    const data: ReceiptPdfData = body.timeZone
      ? { ...receiptData, timeZone: body.timeZone }
      : receiptData;

    const { fileName, buffer } =
      await this.reportsService.generateReceiptPdf(data);

    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.send(buffer);
  }

  // Export transfer PDF
  @Post("transfer/export/pdf")
  @Permissions("reports.export")
  @ApiOperation({ summary: "Export transfer PDF by transferId" })
  @ApiProduces("application/pdf")
  @ApiOkResponse({
    description: "PDF file",
    content: {
      "application/pdf": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  async exportTransferPdf(
    @Body() body: { transferId: string },
    @Res() res: Response
  ) {
    const transferData: TransferPdfData =
      await this.stockTransfersService.getTransferPdfData(body.transferId);

    const { fileName, buffer } =
      await this.reportsService.generateTransferPdf(transferData);

    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.send(buffer);
  }

  // Export installment receipt PDF
  @Post("installment-receipt/export/pdf")
  @Permissions("reports.export")
  @ApiOperation({ summary: "Export installment receipt PDF by installmentId" })
  @ApiProduces("application/pdf")
  @ApiOkResponse({
    description: "PDF file",
    content: {
      "application/pdf": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  async exportInstallmentReceiptPdf(
    @Body() body: { installmentId: string; timeZone?: string },
    @Res() res: Response
  ) {
    const receiptData: ReceiptPdfData =
      await this.ordersService.getInstallmentReceiptPdfData(body.installmentId);
    const data: ReceiptPdfData = body.timeZone
      ? { ...receiptData, timeZone: body.timeZone }
      : receiptData;

    const { fileName, buffer } =
      await this.reportsService.generateReceiptPdf(data);

    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.send(buffer);
  }

  // Export payment receipt PDF
  @Post("payment-receipt/export/pdf")
  @Permissions("reports.export")
  @ApiOperation({ summary: "Export payment receipt PDF by paymentId" })
  @ApiProduces("application/pdf")
  @ApiOkResponse({
    description: "PDF file",
    content: {
      "application/pdf": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  async exportPaymentReceiptPdf(
    @Body() body: { paymentId: string; timeZone?: string },
    @Res() res: Response
  ) {
    const receiptData: ReceiptPdfData =
      await this.paymentsService.getPaymentReceiptPdfData(body.paymentId);
    const data: ReceiptPdfData = body.timeZone
      ? { ...receiptData, timeZone: body.timeZone }
      : receiptData;

    const { fileName, buffer } =
      await this.reportsService.generateReceiptPdf(data);

    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.send(buffer);
  }

  // Export cash session PDF
  @Post("cash-sessions/export/pdf")
  @Permissions("reports.export")
  @ApiOperation({ summary: "Export cash session PDF by sessionId" })
  @ApiProduces("application/pdf")
  @ApiOkResponse({
    description: "PDF file",
    content: {
      "application/pdf": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  async exportCashSessionPdf(
    @Body() body: { sessionId: string; timeZone?: string },
    @Res() res: Response
  ) {
    const cashSessionData = await this.cashSessionService.getCashSessionPdfData(
      body.sessionId
    );
    const dataWithTimeZone = body.timeZone
      ? { ...cashSessionData, timeZone: body.timeZone }
      : cashSessionData;

    const { fileName, buffer } =
      await this.reportsService.generateCashSessionPdf(dataWithTimeZone);

    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.send(buffer);
  }

  @Post("sales/products/preview")
  @Permissions("reports.export")
  @ApiOperation({ summary: "Preview sales by product report" })
  async previewSalesByProduct(
    @Body()
    body: {
      from?: string;
      to?: string;
      productName?: string;
      productVariantName?: string;
      productVariantSku?: string;
      brandId?: string;
      orderNumber?: string;
      branchId?: string;
      employeeId?: string;
      productId?: string;
      productVariantId?: string;
    }
  ) {
    return this.productVariantsService.listSalesByProductItems({
      page: 1,
      limit: 20,
      from: body.from,
      to: body.to,
      productName: body.productName,
      productVariantName: body.productVariantName,
      productVariantSku: body.productVariantSku,
      brandId: body.brandId,
      orderNumber: body.orderNumber,
      branchId: body.branchId,
      employeeId: body.employeeId,
      productId: body.productId,
      productVariantId: body.productVariantId,
    });
  }

  @Post("sales/products/export/excel")
  @Permissions("reports.export")
  @ApiOperation({ summary: "Export sales by product report (Excel)" })
  @ApiProduces(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
  @ApiOkResponse({
    description: "Excel file",
    content: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  async exportSalesByProductExcel(
    @Body()
    body: {
      from?: string;
      to?: string;
      productName?: string;
      productVariantName?: string;
      productVariantSku?: string;
      brandId?: string;
      orderNumber?: string;
      branchId?: string;
      employeeId?: string;
      productId?: string;
      productVariantId?: string;
      maxRows?: number;
    },
    @Res() res: Response
  ) {
    const req = await this.productVariantsService.exportSalesByProductReport({
      from: body.from,
      to: body.to,
      productName: body.productName,
      productVariantName: body.productVariantName,
      productVariantSku: body.productVariantSku,
      brandId: body.brandId,
      orderNumber: body.orderNumber,
      branchId: body.branchId,
      employeeId: body.employeeId,
      productId: body.productId,
      productVariantId: body.productVariantId,
      maxRows: body.maxRows,
    });

    const { fileName, buffer } =
      await this.reportsService.generateReportFromData(req);
    res.status(200);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Post("sales/products/export/PDF")
  @Permissions("reports.export")
  @ApiOperation({ summary: "Export sales by product report (PDF)" })
  @ApiProduces("application/pdf")
  @ApiOkResponse({
    description: "PDF file",
    content: {
      "application/pdf": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  async exportSalesByProductPdf(
    @Body()
    body: {
      from?: string;
      to?: string;
      productName?: string;
      productVariantName?: string;
      productVariantSku?: string;
      brandId?: string;
      orderNumber?: string;
      branchId?: string;
      productId?: string;
      employeeId?: string;
      productVariantId?: string;
      timeZone?: string;
      maxRows?: number;
    },
    @Res() res: Response
  ) {
    const req = await this.productVariantsService.exportSalesByProductReport({
      from: body.from,
      to: body.to,
      productName: body.productName,
      productVariantName: body.productVariantName,
      productVariantSku: body.productVariantSku,
      brandId: body.brandId,
      orderNumber: body.orderNumber,
      branchId: body.branchId,
      productId: body.productId,
      employeeId: body.employeeId,
      productVariantId: body.productVariantId,
      maxRows: body.maxRows,
    });
    const { fileName, buffer } = await this.reportsService.generatePdfFromData(
      body.timeZone ? { ...req, pdfTimeZone: body.timeZone } : req
    );
    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.send(buffer);
  }

  // list sales items by product (paginated)
  @Get("sales/products/items")
  @Permissions("reports.export")
  @ApiOperation({ summary: "List sales items by product (paginated)" })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page",
  })
  @ApiQuery({ name: "from", required: false, type: String })
  @ApiQuery({ name: "to", required: false, type: String })
  @ApiQuery({ name: "branchId", required: false, type: String })
  @ApiQuery({ name: "productId", required: false, type: String })
  @ApiQuery({ name: "productVariantId", required: false, type: String })
  @ApiQuery({ name: "productName", required: false, type: String })
  @ApiQuery({ name: "productVariantName", required: false, type: String })
  @ApiQuery({ name: "productVariantSku", required: false, type: String })
  @ApiQuery({ name: "brandId", required: false, type: String })
  @ApiQuery({ name: "orderNumber", required: false, type: String })
  @ApiQuery({ name: "employeeId", required: false, type: String })
  async listSalesItemsByProduct(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("branchId") branchId?: string,
    @Query("productId") productId?: string,
    @Query("productVariantId") productVariantId?: string,
    @Query("productName") productName?: string,
    @Query("productVariantName") productVariantName?: string,
    @Query("productVariantSku") productVariantSku?: string,
    @Query("brandId") brandId?: string,
    @Query("orderNumber") orderNumber?: string,
    @Query("employeeId") employeeId?: string
  ) {
    const result = await this.productVariantsService.listSalesByProductItems({
      page,
      limit,
      from,
      to,
      branchId,
      productId,
      productVariantId,
      productName,
      productVariantName,
      productVariantSku,
      brandId,
      orderNumber,
      employeeId,
    });
    return result;
  }

  @Post("supplier-order/export/pdf")
  @Permissions("reports.export")
  @ApiOperation({ summary: "Export supplier purchase order PDF by orderId" })
  @ApiProduces("application/pdf")
  @ApiOkResponse({
    description: "PDF file",
    content: {
      "application/pdf": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  async exportSupplierOrderPdf(
    @Body() body: { orderId: string },
    @Res() res: Response
  ) {
    //get pdf data
    const pdfData = await this.supplierOrderService.getSupplierOrderPdfData(
      body.orderId
    );

    // generate PDF
    const { fileName, buffer } =
      await this.reportsService.generateSupplierOrderPdf(pdfData);

    // sent PDF response
    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store, max-age=0");

    // sanitize filename
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );

    res.send(buffer);
  }

  @Post("products/catalog/export/pdf")
  @Permissions("products.read")
  @ApiOperation({
    summary:
      "Export product catalog PDF (cosmetics layout; respects search, brand, category filters)",
  })
  @ApiProduces("application/pdf")
  @ApiOkResponse({
    description: "PDF file",
    content: {
      "application/pdf": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  async exportProductCatalogPdf(
    @Body() body: ProductCatalogPdfExportDto,
    @Res() res: Response
  ) {
    const { fileName, buffer } =
      await this.reportsService.generateProductCatalogPdf({
        search: body.search,
        brandId: body.brandId,
        categoryId: body.categoryId,
      });

    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store, max-age=0");

    const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.end(buffer);
  }

  @Post("quote/export/pdf")
  @Permissions("reports.export")
  @ApiOperation({ summary: "Export quote PDF by quoteId" })
  @ApiProduces("application/pdf")
  @ApiOkResponse({
    description: "PDF file",
    content: {
      "application/pdf": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  async exportQuotePdf(
    @Body() body: { quoteId: string; timeZone?: string },
    @Res() res: Response
  ) {
    // Get quote PDF data
    const pdfData = await this.quotesService.getQuotePdfData(body.quoteId);
    const data = body.timeZone
      ? { ...pdfData, timeZone: body.timeZone }
      : pdfData;

    // Generate PDF
    const { fileName, buffer } =
      await this.reportsService.generateQuotePdf(data);

    // Send PDF response
    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store, max-age=0");

    // Sanitize filename
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );

    res.send(buffer);
  }

  /**
   * List stock movements (paginated) for the UI Table preview
   */
  @Get("stock-movements/items")
  @Permissions("reports.export")
  @ApiOperation({ summary: "List stock movements (paginated preview)" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "fromDate", required: false, type: String })
  @ApiQuery({ name: "toDate", required: false, type: String })
  @ApiQuery({ name: "fromLocationId", required: false, type: String })
  @ApiQuery({ name: "toLocationId", required: false, type: String })
  @ApiQuery({ name: "createdBy", required: false, type: String })
  @ApiQuery({ name: "productId", required: false, type: String })
  @ApiQuery({ name: "productVariantId", required: false, type: String })
  @ApiQuery({ name: "movementType", required: false, type: String })
  @ApiQuery({ name: "reference", required: false, type: String })
  async listStockMovementsPreview(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query("fromDate") fromDate?: string,
    @Query("toDate") toDate?: string,
    @Query("fromLocationId") fromLocationId?: string,
    @Query("toLocationId") toLocationId?: string,
    @Query("createdBy") createdBy?: string,
    @Query("productId") productId?: string,
    @Query("productVariantId") productVariantId?: string,
    @Query("movementType") movementType?: any,
    @Query("reference") reference?: string
  ) {
    return this.stockMovementsService.listStockMovementsPreview({
      page,
      limit,
      fromDate,
      toDate,
      fromLocationId,
      toLocationId,
      createdBy,
      productId,
      productVariantId,
      movementType,
      reference,
    });
  }

  /**
   * Export stock movements report to PDF
   */
  @Post("stock-movements/export/pdf")
  @Permissions("reports.export")
  @ApiOperation({ summary: "Export stock movements report (PDF)" })
  @ApiProduces("application/pdf")
  @ApiOkResponse({
    description: "PDF file",
    content: {
      "application/pdf": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  async exportStockMovementsPdf(
    @Body()
    body: {
      fromDate?: string;
      toDate?: string;
      fromLocationId?: string;
      toLocationId?: string;
      createdBy?: string;
      productId?: string;
      productVariantId?: string;
      movementType?: any;
      reference?: string;
      movementsIds?: string[];
      skip?: number;
      take?: number;
      maxRows?: number;
      timeZone?: string;
      generatedAt?: string;
      generatedAtFormatted?: string;
    },
    @Res() res: Response
  ) {
    const {
      timeZone,
      generatedAt,
      generatedAtFormatted,
      maxRows,
      ...filterBody
    } = body;
    // 1. Get the structured data for the report
    const reportData =
      await this.stockMovementsService.getStockMovementReportData({
        ...filterBody,
        ...(typeof maxRows === "number" ? { take: maxRows } : {}),
      });

    // 2. Generate the PDF buffer using the reports service bridge
    const { fileName, buffer } =
      await this.reportsService.generateStockMovementsPdf({
        ...reportData,
        ...(timeZone ? { timeZone } : {}),
        ...(generatedAt ? { generatedAt } : {}),
        ...(generatedAtFormatted ? { generatedAtFormatted } : {}),
      });

    // 3. Set standard PDF response headers
    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store, max-age=0");

    // 4. Sanitize and set filename
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );

    res.send(buffer);
  }

  @Get("dashboard/sales-trend")
  @Permissions("orders.read")
  @ApiOperation({
    summary: "Daily sales amount and order count for dashboard chart",
  })
  @ApiQuery({
    name: "from",
    required: true,
    type: String,
    description: "YYYY-MM-DD (UTC day)",
  })
  @ApiQuery({
    name: "to",
    required: true,
    type: String,
    description: "YYYY-MM-DD (UTC day)",
  })
  @ApiQuery({ name: "locationId", required: false, type: String })
  async getDashboardSalesTrend(
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("locationId") locationId?: string
  ) {
    return this.reportsService.getDashboardSalesTrend({
      from,
      to,
      locationId,
    });
  }

  @Get("dashboard/revenue")
  @Permissions("orders.read")
  @ApiOperation({
    summary: "Daily revenue for dashboard chart (optional branch)",
  })
  @ApiQuery({ name: "from", required: true, type: String })
  @ApiQuery({ name: "to", required: true, type: String })
  @ApiQuery({ name: "branchId", required: false, type: String })
  async getDashboardRevenue(
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("branchId") branchId?: string
  ) {
    return this.reportsService.getDashboardRevenue({ from, to, branchId });
  }

  @Get("dashboard/top-products")
  @Permissions("orders.read")
  @ApiOperation({ summary: "Top 10 products by units sold in date range" })
  @ApiQuery({ name: "from", required: true, type: String })
  @ApiQuery({ name: "to", required: true, type: String })
  @ApiQuery({ name: "locationId", required: false, type: String })
  async getDashboardTopProducts(
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("locationId") locationId?: string
  ) {
    return this.reportsService.getDashboardTopProducts({
      from,
      to,
      locationId,
    });
  }

  @Get("dashboard/stock-in-cost")
  @Permissions("orders.read")
  @ApiOperation({
    summary:
      "Daily cost of goods sold (UTC) in date range — effective quantity × variant cost price",
  })
  @ApiQuery({ name: "from", required: true, type: String })
  @ApiQuery({ name: "to", required: true, type: String })
  @ApiQuery({ name: "locationId", required: false, type: String })
  async getDashboardStockInCost(
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("locationId") locationId?: string
  ) {
    return this.reportsService.getDashboardStockInCost({
      from,
      to,
      locationId,
    });
  }

  @Get("dashboard/stats")
  @Permissions("orders.read")
  @ApiOperation({ summary: "Get aggregated dashboard statistics" })
  @ApiQuery({
    name: "locationId",
    required: false,
    type: String,
    description: "Optional location filter",
  })
  async getDashboardStats(@Query("locationId") locationId?: string) {
    return this.reportsService.getDashboardStats(locationId);
  }
}
