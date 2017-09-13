import Fluxxor from 'fluxxor';
import constants from '../actions/constants';
import { momentGetFromToRange } from '../utils/Utils.js';
import moment from 'moment';

function makeMap(items, keyFunc, valueFunc) {
    let map = new Map();

    items.forEach(item => {
        const key = keyFunc(item);
        const value = valueFunc(item);
        map.set(key, Object.assign({}, (map.get(key) || {}), value));
    });

    return map;
}

function convertDateValueToRange(timeSelection, timeType){
    const formatter = constants.TIMESPAN_TYPES[timeType];
    return momentGetFromToRange(timeSelection, formatter.format, formatter.rangeFormat);
}

export const DataStore = Fluxxor.createStore({
    initialize(profile) {

        this.dataStore = {
            userProfile: profile,
            timespanType: constants.DEFAULT_TIMESPAN_TYPE,
            datetimeSelection: moment().format(constants.DEFAULT_TIMEPERIOD_FORMAT),
            dataSource: constants.DEFAULT_DATA_SOURCE,
            fromDate: false,
            toDate: false,
            settings: {},
            title: "",
            logo: "",
            conjunctivetopics: [],
            externalsourceid: constants.DEFAULT_EXTERNAL_SOURCE,
            placeId: "",
            timeSeriesGraphData: {},
            popularLocations: [],
            targetBbox: [],
            popularTerms: [],
            topSources: [],
            timeSeriesCsv: "",
            popularLocationsCsv: "",
            popularTermsCsv: "",
            topSourcesCsv: "",
            trustedSources: [],
            supportedLanguages: [],
            termFilters: new Set(),
            heatmapTileIds: [],
            fullTermList: new Map(),
            bbox: [],
            zoomLevel: constants.HEATMAP_DEFAULT_ZOOM,
            maintopic: false,
            language: constants.LANGUAGE_CODE_ENG
        }

        this.bindActions(
            constants.DASHBOARD.INITIALIZE, this.intializeSettings,
            constants.DASHBOARD.RELOAD_CHARTS, this.handleReloadChartData,
            constants.DASHBOARD.CHANGE_LANGUAGE, this.handleLanguageChange
        );
    },

    getState() {
        return this.dataStore;
    },

    handleLanguageChange(gqlRespomse) {
        const { terms, language } = gqlRespomse;
        
        this.dataStore.language = language;
        this.dataStore.fullTermList = makeMap(terms.edges, term=>term.name, term=>term);
        this.emit("change");
    },

    syncChartDataToStore(graphqlResponse){
        const { locations, topics, sources, timeSeries, conjunctiveterms } = graphqlResponse;
        this.dataStore.popularLocations = locations && locations.edges ? locations.edges : [];
        this.dataStore.popularLocationsCsv = (locations && locations.csv && locations.csv.url) || "";
        this.dataStore.popularTerms = topics && topics.edges ? topics.edges : [];
        this.dataStore.popularTermsCsv = (topics && topics.csv && topics.csv.url) || "";
        this.dataStore.conjunctivetopics = conjunctiveterms && conjunctiveterms.edges ? conjunctiveterms.edges : [];
        this.dataStore.topSources = sources && sources.edges ? sources.edges : [];
        this.dataStore.topSourcesCsv = (sources && sources.csv && sources.csv.url) || "";
        this.syncTimeSeriesData(timeSeries || []);
    },

    intializeSettings(graphqlResponse) {
        const { terms, configuration, topics } = graphqlResponse;
        const { datetimeSelection, timespanType } = this.dataStore;
        const { defaultLanguage, logo, title, targetBbox, supportedLanguages, defaultZoomLevel } = configuration;
        const { fromDate, toDate } = convertDateValueToRange(datetimeSelection, timespanType);

        this.dataStore.fullTermList = makeMap(terms.edges, term=>term.name, term=>term);
        this.dataStore.title = title;
        this.dataStore.fromDate = fromDate;
        this.dataStore.toDate = toDate;
        this.dataStore.logo = logo;
        this.dataStore.language = defaultLanguage;
        this.dataStore.zoomLevel = defaultZoomLevel;
        this.dataStore.bbox = targetBbox || [];
        this.dataStore.targetBbox = targetBbox;
        this.dataStore.supportedLanguages = supportedLanguages;
        this.dataStore.maintopic = topics.edges.length ? topics.edges[0].name : '';
        this.dataStore.settings = configuration;
        this.syncChartDataToStore(graphqlResponse);

        this.dataStore.termFilters.clear();
        this.emit("change");
    },

    syncTimeSeriesData(mutatedTimeSeries) {
        this.dataStore.timeSeriesGraphData = { labels: [], graphData: [] };
        this.dataStore.heatmapTileIds = [];

        if (mutatedTimeSeries && mutatedTimeSeries.graphData && mutatedTimeSeries.labels && mutatedTimeSeries.graphData.length) {
            const { labels, graphData, tiles } = mutatedTimeSeries;
            this.dataStore.timeSeriesGraphData = Object.assign({}, { labels });
            this.dataStore.timeSeriesCsv = (mutatedTimeSeries.csv && mutatedTimeSeries.csv.url) || "";
            
            const timeseriesMap = makeMap(graphData, item=>item.date, item=>{
                let timeSeriesEntry = {date: item.date};
                timeSeriesEntry[item.name] = item.mentions;

                return timeSeriesEntry;
            });

            let sorted = Array.from(timeseriesMap.values()).sort((a, b)=>moment(a.date).unix() > moment(b.date).unix());
            this.dataStore.timeSeriesGraphData.graphData = sorted;
            this.dataStore.heatmapTileIds = tiles;
        }
    },

    syncFilterSelections(mutatedFilters){
        const { fromDate, toDate, periodType, zoomLevel, dataSource, placeId, datetimeSelection, maintopic, 
            externalsourceid, selectedconjunctiveterms, bbox } = mutatedFilters;

        this.dataStore.fromDate = fromDate;
        this.dataStore.toDate = toDate;
        this.dataStore.timespanType = periodType;
        this.dataStore.dataSource = dataSource;
        this.dataStore.maintopic = maintopic;
        this.dataStore.placeId = placeId;
        this.dataStore.bbox = bbox;
        this.dataStore.datetimeSelection = datetimeSelection;
        this.dataStore.zoomLevel = zoomLevel;
        this.dataStore.externalsourceid = externalsourceid;
        this.dataStore.termFilters = new Set(selectedconjunctiveterms);
    },

    handleReloadChartData(changedData) {
        this.syncChartDataToStore(changedData);
        this.syncFilterSelections(changedData);
        this.emit("change");
    }
});