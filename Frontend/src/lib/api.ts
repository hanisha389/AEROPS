import axios from 'axios';

export const api = {
  getPilots: () => axios.get('/mock/pilots.json').then(res => res.data),
  getEngineers: () => axios.get('/mock/engineers.json').then(res => res.data),
  getAircrafts: () => axios.get('/mock/aircrafts.json').then(res => res.data),
};
