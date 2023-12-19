import { Controller, Get } from "@nestjs/common";
import { ScrapingService } from "./scraping.service";

@Controller('scraping')
export class ScrapingController {
    constructor(private readonly scrapingService: ScrapingService){}

    @Get('/computrabajo')
    scrapeComputrabajo() {
        return this.scrapingService.scrapeComputrabajo();
    }
}