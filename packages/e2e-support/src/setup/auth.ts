import axios from 'axios';
import { e2eConfig } from '../e2e-config';

axios.defaults.baseURL = e2eConfig.baseUrl;
axios.defaults.validateStatus = () => true;

console.log(`[e2e] auth API base URL: ${e2eConfig.baseUrl}`);
