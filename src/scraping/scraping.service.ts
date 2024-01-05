import { Injectable } from "@nestjs/common";
import { chromium } from "playwright";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Job, JobModel } from './job.model';

@Injectable()
export class ScrapingService {
    private readonly SEARCH_KEYWORD = 'web developer';
    private readonly DATE_FILTER_ATTRIBUTES = {
        Urgente: 99,
        Hoy: 1,
        UltimosTresDias: 3,
        UltimaSemana: 7,
        UltimosQuinceDias: 15,
        UltimoMes: 30,
    };

    constructor(@InjectModel('Job') private readonly jobModel: Model<Job>) { }

    async jobScrape(): Promise<any> {
        const browser = await chromium.launch({
            headless: false
        });

        const context = await browser.newContext();
        const page = await context.newPage();
        let newJobsCounter = 0; // Inicializar el contador

        try {
            await page.goto('https://co.computrabajo.com/');

            await page.type('#prof-cat-search-input[type=search]', this.SEARCH_KEYWORD);
            await page.waitForTimeout(1000);
            await page.click('#search-button');

            // Esperar a que aparezca el pop-up
            const popup = await page.waitForSelector('#pop-up-webpush-sub', { timeout: 5000 }).catch(() => null);

            if (popup) {

                // Hacer clic en el botón "Ahora no"
                const closeButton = await page.$('#pop-up-webpush-sub button[onclick="webpush_subscribe_ko(event);"]');
                if (closeButton) {
                    await closeButton.click();
                }
            } else {
                console.log('El pop-up no está presente, continúa con el código.');
            }

            const elements = await page.$$('div.filters div.field_select_links');

            // Comprobar si hay al menos dos elementos
            if (elements.length >= 2) {
                // Hacer clic en el segundo elemento
                await elements[1].click();
            } else {
                console.error('No hay suficientes elementos para hacer clic en el segundo elemento.');
            }

            // Obtener el valor del filtro de fecha utilizando la constante
            const dateFilterValue = this.DATE_FILTER_ATTRIBUTES.UltimaSemana;

            // Esperar a que aparezca el elemento <span>
            await page.waitForSelector(`span.buildLink[data-path="?pubdate=${dateFilterValue}"]`);

            // Hacer clic en el elemento <span>
            const dateFilter = await page.$(`span.buildLink[data-path="?pubdate=${dateFilterValue}"]`);
            if (dateFilter) {
                await dateFilter.click();
            } else {
                console.error(`No se encontró el elemento <span> con el atributo data-path="?pubdate=${dateFilterValue}"`);
            }

            // Se inicia el proceso de recopilación y procesamiento de enlaces
            const links = await this.collectLinks(page);

            // Ahora, procesamos cada enlace para obtener los detalles del trabajo
            const jobDetails = [];
            for (let link of links) {
                // Espera entre solicitudes para reducir la velocidad
                const jobDetail = await this.processJobDetails(page, link);

                // Guardar en la base de datos
                try {
                    const newJob = new this.jobModel(jobDetail);
                    await newJob.save();
                    jobDetails.push(jobDetail);
                    newJobsCounter++;

                } catch (error) {
                    // Verifica si el error es debido a un índice único duplicado
                    if (error.code === 11000) {
                        console.log('El trabajo ya existe en la base de datos.');
                    } else {
                        // Si es un error diferente, lo relanzas para que sea manejado por el sistema
                        throw error;
                    }
                }

                await page.waitForTimeout(1000);
            }
            console.log(`Proceso completado. Se agregaron ${newJobsCounter} trabajos nuevos a la base de datos.`);
            return jobDetails;
        } finally {
            await context.close();
            await browser.close();
        }
    }

    async collectLinks(page) {
        const links = [];
        const visitedLinks = new Set();

        // Función para procesar una página y recopilar enlaces
        const processPage = async () => {

            const currentLinks = await page.evaluate(() => {
                const items = document.querySelectorAll('article.box_offer h2 a');
                const links = [];
                const visitedTitles = new Set<string>();

                for (let item of items) {
                    const anchorElement = item as HTMLAnchorElement;

                    // Modificación para quitar la parte después del #
                    const cleanLink = anchorElement.href.split('#')[0];

                    // Obtener el texto del h2 y verificar duplicados
                    const title = anchorElement.textContent?.trim();
                    if (title && !visitedTitles.has(title)) {
                        visitedTitles.add(title);
                        links.push(cleanLink);
                    }
                }

                return links;
            });

            // Agregar enlaces de la página actual al conjunto y a la lista general
            for (let currentLink of currentLinks) {
                if (!visitedLinks.has(currentLink)) {
                    visitedLinks.add(currentLink);
                    links.push(currentLink);
                }
            }

            // Intentar hacer clic en el botón "Siguiente"
            const nextButton = await page.$('div.tj_fx span.buildLink[title="Siguiente"]');
            if (!nextButton) {
                return false;  // Si el botón "Siguiente" no está presente, salir
            }

            await nextButton.click();
            await page.waitForSelector('#offersGridOfferContainer article');

            return true;  // Indicar que se procesó correctamente la página
        };

        // Bucle para procesar páginas
        while (await processPage()) {
            // El bucle seguirá hasta que no haya más páginas
        }


        return links;
    }

    async processJobDetails(page, link) {
        await page.goto(link);

        const title = await page.evaluate(() => {
            const titleElement = document.querySelector('h1');
            return titleElement ? titleElement.textContent : null;
        });

        const company = await page.evaluate(() => {
            const firstSelector = document.querySelector('div.info_company a.fs16.js-o-link');
            const secondSelector = document.querySelector('div.container p.fs16');

            if (firstSelector) {
                return firstSelector.textContent;
            } else if (secondSelector) {
                return secondSelector.textContent;
            } else {
                return null;
            }
        });

        const location = await page.evaluate(() => {
            const boxBorderElement = document.querySelector('div.box_resume div.box_border');
            const paragraphs = boxBorderElement?.querySelectorAll('p.fs16');

            if (paragraphs && paragraphs.length > 0) {
                const lastParagraph = paragraphs[paragraphs.length - 1];
                return lastParagraph ? lastParagraph.textContent : null;
            }

            return null;
        });

        const salary = await page.evaluate(() => {
            const salaryElement = document.querySelector('div.mbB span.mb10');
            return salaryElement ? salaryElement.textContent : null;
        });

        const keyword = await page.evaluate(() => {
            const keywordElement = document.querySelector('div.pb40 p.fc_aux');
            const keywordText = keywordElement?.textContent || '';

            const keywords = keywordText.replace('Palabras clave:', '').trim().split(', ');

            return keywords;
        });

        const requirement = await page.evaluate(() => {
            const ulElement = document.querySelector('div.mb40 ul.mbB');
            const items = ulElement?.querySelectorAll('li') || [];

            const extractedRequirements = Array.from(items).map((item) => item.textContent.trim());

            return {
                education: extractedRequirements[0]?.replace('Educación mínima:', '').trim() || null,
                experience: extractedRequirements[1] || null,
                languages: extractedRequirements[2]?.replace('Idiomas:', '').trim() || null,
                skills: extractedRequirements[3]
                    ? extractedRequirements[3].replace('Conocimientos:', '').split(', ').map((skill) => skill.trim())
                    : null,
            };
        });

        return { title, company, location, salary, keyword, requirement };
    }
}