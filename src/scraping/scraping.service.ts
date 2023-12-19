import { Injectable } from "@nestjs/common";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Job, JobModel} from './job.model';
@Injectable()
export class ScrapingService {
    constructor(@InjectModel('Job') private readonly jobModel: Model <Job>){}

    async scrapeComputrabajo(): Promise<any> {

            const browser = await chromium.launch({
                headless: false
            });

            const context = await browser.newContext();
            const page = await context.newPage();
            try {
                await page.goto('https://co.computrabajo.com/');

                await page.type('#prof-cat-search-input[type=search]', 'programador junior');
                await page.waitForTimeout(1000);
                await page.click('#search-button');

                await page.waitForSelector('#offersGridOfferContainer article');

                const links = await page.evaluate(() => {
                    const items = document.querySelectorAll('article.box_offer h2 a');

                    const links: string[] = [];
                    for (let item of items) {
                        const anchorElement = item as HTMLAnchorElement;
                        links.push(anchorElement.href);
                    }

                    return links
                });
                console.log(links);

                const jobDetails = [];
                for (let link of links) {
                    await page.goto(link);

                    const h1text = await page.evaluate(() => document.querySelector('h1').innerText);
                    console.log(h1text);

                    const newJob = new this.jobModel({ title: h1text});
                    await newJob.save();

                    jobDetails.push({ title: h1text});
                    await page.waitForTimeout(1000);
                }
                return jobDetails;
            } finally {
                await context.close();
                await browser.close();
            }
    }
}