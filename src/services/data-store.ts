import fs from 'fs';
import path from 'path';

export interface StoredData {
  competitor: string;
  updates: any[];
  lastScraped: string;
  success: boolean;
}

export class DataStore {
  private dataDir: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.ensureDataDir();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private getFilePath(competitor: string): string {
    return path.join(this.dataDir, `${competitor}.json`);
  }

  async store(competitor: string, data: any): Promise<void> {
    const storedData: StoredData = {
      competitor,
      updates: data.updates || [],
      lastScraped: new Date().toISOString(),
      success: true
    };

    try {
      const filePath = this.getFilePath(competitor);
      fs.writeFileSync(filePath, JSON.stringify(storedData, null, 2));
      console.log(`Stored data for ${competitor}: ${storedData.updates.length} updates`);
    } catch (error) {
      console.error(`Error storing data for ${competitor}:`, error);
    }
  }

  async retrieve(competitor: string): Promise<StoredData | null> {
    try {
      const filePath = this.getFilePath(competitor);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = fs.readFileSync(filePath, 'utf8');
      const storedData: StoredData = JSON.parse(data);
      
      // Check if data is recent (within 10 minutes)
      const lastScraped = new Date(storedData.lastScraped);
      const now = new Date();
      const ageInMinutes = (now.getTime() - lastScraped.getTime()) / (1000 * 60);
      
      if (ageInMinutes > 10) {
        console.log(`Stored data for ${competitor} is ${ageInMinutes.toFixed(1)} minutes old`);
      }
      
      return storedData;
    } catch (error) {
      console.error(`Error retrieving data for ${competitor}:`, error);
      return null;
    }
  }

  async retrieveAll(): Promise<StoredData[]> {
    try {
      const files = fs.readdirSync(this.dataDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      const allData: StoredData[] = [];
      
      for (const file of jsonFiles) {
        const competitor = file.replace('.json', '');
        const data = await this.retrieve(competitor);
        if (data) {
          allData.push(data);
        }
      }
      
      return allData;
    } catch (error) {
      console.error('Error retrieving all data:', error);
      return [];
    }
  }

  async storeFailure(competitor: string, error: string): Promise<void> {
    const storedData: StoredData = {
      competitor,
      updates: [],
      lastScraped: new Date().toISOString(),
      success: false
    };

    try {
      const filePath = this.getFilePath(competitor);
      fs.writeFileSync(filePath, JSON.stringify(storedData, null, 2));
      console.log(`Stored failure for ${competitor}: ${error}`);
    } catch (err) {
      console.error(`Error storing failure for ${competitor}:`, err);
    }
  }

  async getDataAge(competitor: string): Promise<number | null> {
    try {
      const data = await this.retrieve(competitor);
      if (!data) return null;
      
      const lastScraped = new Date(data.lastScraped);
      const now = new Date();
      return (now.getTime() - lastScraped.getTime()) / (1000 * 60); // age in minutes
    } catch (error) {
      return null;
    }
  }
} 