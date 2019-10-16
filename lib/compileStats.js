const path = require('path');
const fs = require('fs');
const _ = require('lodash');

const statsFileName = 'stats.json';

function loadStatsFromFile(webpackOutputPath) {
  const statsFile = getStatsFilePath(webpackOutputPath);
  const data = fs.readFileSync(statsFile);
  const stats = JSON.parse(data);

  if (!stats.stats || !stats.stats.length) {
    throw new this.serverless.classes.Error('Packaging: No stats information found');
  }

  const mappedStats = _.map(stats.stats, s =>
    _.assign({}, s, { outputPath: path.resolve(webpackOutputPath, s.outputPath) })
  );

  return { stats: mappedStats };
}

const getStatsFilePath = webpackOutputPath => path.join(webpackOutputPath, statsFileName);

module.exports = {
  getCompileStats() {
    const stats = this.stats || loadStatsFromFile.call(this, this.webpackOutputPath);

    return stats;
  },
  saveCompileStats(stats) {
    this.stats = stats;

    const statsJson = _.invokeMap(this.stats.stats, 'toJson');

    const normalisedStats = _.map(statsJson, s => {
      return _.assign({}, s, { outputPath: path.relative(this.webpackOutputPath, s.outputPath) });
    });

    const statsFile = getStatsFilePath(this.webpackOutputPath);

    fs.writeFileSync(statsFile, JSON.stringify({ stats: normalisedStats }, null, 2));

    return;
  }
};
