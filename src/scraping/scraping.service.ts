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

    // Funciones para el scrape de computrabajo

    async scrapeComputrabajo(): Promise<any> {
        const browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                `--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36`,
            ],
        });

        const context = await browser.newContext();
        const page = await context.newPage();
        let newJobsCounter = 0; // Inicializar el contador

        try {
            const inputSearch = encodeURIComponent(this.SEARCH_KEYWORD);
            // Obtener el valor del filtro de fecha utilizando la constante
            const dateFilterValue = encodeURIComponent(this.DATE_FILTER_ATTRIBUTES.Hoy);

            const url = `https://co.computrabajo.com/trabajo-de-${inputSearch}?pubdate=${dateFilterValue}`;
            await page.goto(url);

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

                await page.waitForTimeout(2000);
            }
            console.log(`Proceso completado. Se agregaron ${newJobsCounter} trabajos nuevos a la base de datos desde CompuTrabajos.`);
            return jobDetails;
        } finally {
            await context.close();
            await browser.close();
        }
    }

    async collectLinks(page) {
        const links = new Set<string>();
        let hasNextPage = true;

        while (hasNextPage) {
            try {
                await this.handlePopup(page);

                // Esperar a que la página cargue completamente antes de realizar la siguiente acción
                await page.waitForLoadState('load');

                const nextButton = await page.$('div.tj_fx span.buildLink[title="Siguiente"]');
                if (!nextButton) {
                    hasNextPage = false;
                } else {
                    // Esperar a que la página cargue completamente después de hacer clic en el botón "Siguiente"
                    const navigationPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded' });

                    await Promise.all([
                        navigationPromise,
                        nextButton.click(),
                    ]);

                    // Verificar si la página aún está abierta antes de continuar
                    if (page.isClosed()) {
                        console.log('La página se cerró antes de que la navegación se completara.');
                        break;
                    }
                }
                const currentLinks = await page.evaluate(() => {
                    const items = document.querySelectorAll('article.box_offer h2 a');
                    const visitedTitles = new Set<string>();
                    const collectedLinks: string[] = [];

                    for (let item of items) {
                        const anchorElement = item as HTMLAnchorElement;
                        const cleanLink = anchorElement.href.split('#')[0];
                        const title = anchorElement.textContent?.trim();

                        if (title && !visitedTitles.has(title)) {
                            visitedTitles.add(title);
                            collectedLinks.push(cleanLink);
                        }
                    }

                    return collectedLinks;
                });

                for (let currentLink of currentLinks) {
                    links.add(currentLink);
                }
            } catch (error) {
                console.error('Error en el bucle de recolección de enlaces:', error);
            }
        }
        return Array.from(links);
    }

    async processJobDetails(page, links) {
        await page.goto(links);

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

            if (keywordText.includes('Palabras clave:')) {
                const keywords = keywordText.replace('Palabras clave:', '').trim().split(', ');
                return keywords;
            }

            return null;
        });

        const requirement = await page.evaluate(() => {
            const ulElement = document.querySelector('div.mb40 ul.mbB');
            const items = ulElement?.querySelectorAll('li') || [];

            const extractedRequirements = Array.from(items).map((item) => item.textContent.trim());

            const educationRegex = /Educación mínima: (.+)/;
            const experienceRegex = /(\d+)\s*años? de experiencia/;
            const languageRegex = /Idiomas: (.+)/;
            const skillsRegex = /Conocimientos: (.+)/;

            const educationMatch = extractedRequirements[0]?.match(educationRegex);
            const experienceMatch = extractedRequirements[1]?.match(experienceRegex);
            const languageMatch = extractedRequirements[2]?.match(languageRegex);
            const skillsMatch = extractedRequirements[3]?.match(skillsRegex);

            return {
                education: educationMatch ? educationMatch[1].trim() : null,
                experience: experienceMatch ? `${experienceMatch[1]} años` : null,
                languages: languageMatch ? languageMatch[1].trim() : null,
                skills: skillsMatch ? skillsMatch[1].split(', ').map((skill) => skill.trim()) : null,
            };
        });

        return { title, company, location, salary, keyword, requirement };
    }

    async handlePopup(page) {
        const popup = await page.waitForSelector('#pop-up-webpush-sub', { timeout: 5000 }).catch(() => null);

        if (popup) {
            const closeButton = await page.$('#pop-up-webpush-sub button[onclick="webpush_subscribe_ko(event);"]');
            if (closeButton) {
                await closeButton.click();
            }
        } else {
            console.log('El pop-up no está presente, continúa con el código.');
        }
    }

    // Funciones para el scrape de GetManfred

    async scrapeGetManfred(): Promise<any> {
        const browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                `--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36`,
            ],
        });

        const context = await browser.newContext();
        const page = await context.newPage();
        let newJobsCounter = 0;

        try {
            await page.goto("https://www.getmanfred.com/ofertas-empleo?onlyActive=true", { waitUntil: "load" });

            // Agrega un console.log para imprimir el contenido de la página
            const pageContent = await page.content();
            console.log("Contenido de la página:", pageContent);


            const links = await this.collectGetManfredLinks(page);
            // Ahora, procesamos cada enlace para obtener los detalles del trabajo
            const jobDetails = [];
            for (let link of links) {
                // Espera entre solicitudes para reducir la velocidad
                const jobDetail = await this.processGetManfredDetails(page, link);

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

                await page.waitForTimeout(4000);
            }
            console.log(`Proceso completado. Se agregaron ${newJobsCounter} trabajos nuevos a la base de datos desde GetManfred.`);
            return jobDetails;
        } finally {
            await context.close();
            await browser.close();
        }
    }

    async collectGetManfredLinks(page) {
        const links = await page.$$eval('div.react-reveal a', (anchors) =>
            anchors.map((anchor) => `https://www.getmanfred.com${anchor.getAttribute('href')}`)
        );

        // Filtrar enlaces para obtener solo uno por título
        const uniqueLinks = await this.filterUniqueTitles(page, links);

        return uniqueLinks;
    }

    async filterUniqueTitles(page, links) {
        const uniqueLinks = [];
        const visitedTitles = new Set();

        for (const link of links) {
            await page.goto(link);
            const title = await page.$eval('h1', (element) => element.textContent.trim());

            if (!visitedTitles.has(title)) {
                visitedTitles.add(title);
                uniqueLinks.push(link);
            }
        }

        return uniqueLinks;
    }

    async processGetManfredDetails(page, link) {
        try {
            await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 60000, handleHTTPStatusCode: true });
        } catch (error) {
            console.error(`Error durante la navegación a ${link}: ${error.message}`);
            return null;  // O maneja el error según tus necesidades
        }

        const title = await page.$eval('h1', (element) => element.textContent.trim());

        // Intentar obtener la información del company del selector original
        let company;
        const companySelector = 'div.kNbsot p strong';
        const companyElement = await page.$(companySelector);

        if (companyElement) {
            // Si se encuentra el elemento, obtener el texto
            company = await page.$eval(companySelector, (element) => element.textContent.trim());
        } else {
            // Si no se encuentra el elemento, obtener la información del atributo "alt" de la imagen
            const altAttribute = await page.$eval('section.gXHpR img.BQqbU', (element) => element.getAttribute('alt'));
            company = altAttribute ? altAttribute.trim() : null;
        }

        const location = null; // Ajusta según tus necesidades

        const salaryElement = await page.$('div.dToAFB span.eLoTjr');
        const salary = salaryElement ? (await salaryElement.textContent()).replace('hasta', '').trim() : null;

        function removeNonAlphanumeric(inputString: string): string {
            // Eliminar todos los caracteres no alfanuméricos
            return inputString.replace(/[^\w\sáéíóúüñÁÉÍÓÚÜÑ]/g, '');
        }

        const keywordElements = await page.$$('div.jFrtk span');
        const keywords = await Promise.all(keywordElements.map(async (element) => {
            const text = await element.textContent();
            const trimmedText = text.trim();

            // Utilizar la función para eliminar caracteres no alfanuméricos
            return removeNonAlphanumeric(trimmedText);
        }));

        const requirementElements = await page.$$('div.kreSbq ul li');
        const requirements = await Promise.all(requirementElements.map(async (element) => {
            const text = await element.textContent();
            return text.trim();
        }));

        return { title, company, location, salary, keyword: keywords, requirement: requirements };
    }

    // Peticiones a la DB

    async findByTitle(): Promise<any[]> {
        return this.jobModel.find({}, 'title').exec();
    }

    async findByCompany(): Promise<any[]> {
        return this.jobModel.find({}, 'company').exec();
    }

    async findByLocation(): Promise<any[]> {
        return this.jobModel.find({}, 'location').exec();
    }

    async findBySalary(): Promise<any[]> {
        return this.jobModel.find({}, 'salary').exec();
    }

    async findByKeyword(): Promise<any[]> {
        return this.jobModel.find({}, 'keyword').exec();
    }

    async getAllJobs(): Promise<Job[]> {
        return this.jobModel.find().exec();
    }

    async findByRequirement(): Promise<any[]> {
        return this.jobModel.find({}, 'requirement').exec();
    }

    async findEducation(): Promise<Job[]> {
        return this.jobModel.find({ 'requirement.education': { $exists: true } }).exec();
    }

    async findExperience(): Promise<Job[]> {
        return this.jobModel.find({ 'requirement.experience': { $exists: true } }).exec();
    }

    async findLanguage(): Promise<Job[]> {
        return this.jobModel.find({ 'requirement.languages': { $exists: true } }).exec();
    }

    async findSkill(): Promise<Job[]> {
        return this.jobModel.find({ 'requirement.skills': { $exists: true } }).exec();
    }

    // Funcion Upsert
    async upsertJob(jobDetails: any): Promise<void> {
        // Implementa la lógica para upsert en la base de datos
        const result = await this.jobModel.updateOne({ title: jobDetails.title }, { $set: jobDetails }, { upsert: true });

        if (result.upsertedCount) {
            console.log(`Job inserted: ${jobDetails.title}`);
        } else if (result.modifiedCount) {
            console.log(`Job updated: ${jobDetails.title}`);
        } else {
            console.log(`No changes for job: ${jobDetails.title}`);
        }
    }

}
