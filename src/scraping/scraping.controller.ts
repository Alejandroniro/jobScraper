import { Controller, Get } from "@nestjs/common";
import { ScrapingService } from "./scraping.service";

@Controller('scraping')
export class ScrapingController {
    constructor(private readonly scrapingService: ScrapingService){}

    @Get('/scrape-all')
    async scrapeAll() {
        try {
            const computrabajoDetails = await this.scrapingService.scrapeComputrabajo();
            const getManfredDetails = await this.scrapingService.scrapeGetManfred();

            return {
                success: true,
                data: {
                    computrabajo: computrabajoDetails,
                    getManfred: getManfredDetails,
                },
            };
        } catch (error) {
            console.error('Error during scraping:', error);
            return { success: false, error: 'An error occurred during scraping.' };
        }
    }
}