/*
 * Copyright (C) 2015-2017, metaphacts GmbH
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, you can receive a copy
 * of the GNU Lesser General Public License from http://www.gnu.org/
 */

import * as moment from 'moment';
import * as uuid from 'uuid';
import * as _ from 'lodash';

import { Rdf, vocabularies } from 'platform/api/rdf';
import {
  SparqlUtil, SparqlClient, QueryVisitor, SparqlTypeGuards, cloneQuery,
} from 'platform/api/sparql';
import * as Model from './Model';
import {
  SemanticSearchConfig, SEMANTIC_SEARCH_VARIABLES, PatternConfig, Resource, Hierarchy, Text, Set,
  getConfigPatternForCategory,
  Place, DateRange, Literal, NumericRange,
} from '../../config/SearchConfig';

const XSD_DATE_FORMAT = 'YYYY-MM-DD';

function DEFAULT_QUERY_PATTERN(resultProjectinVar: string) {
  return `${resultProjectinVar} ?${SEMANTIC_SEARCH_VARIABLES.RELATION_VAR} ?${SEMANTIC_SEARCH_VARIABLES.RESOURCE_VAR} .`;
}

const DEFAULT_SET_QUERY_PATTERN = `
   ?${SEMANTIC_SEARCH_VARIABLES.SET_VAR} ${vocabularies.ldp.contains}/${vocabularies.VocabPlatform.setItem} ?${SEMANTIC_SEARCH_VARIABLES.RESOURCE_VAR} .
`;
function resourceDisjunct(disjunct: Model.ResourceDisjunct) {
  return {[SEMANTIC_SEARCH_VARIABLES.RESOURCE_VAR]: disjunct.value.iri};
}

function setDisjunct(disjucnct: Model.SetDisjunct) {
  return {[SEMANTIC_SEARCH_VARIABLES.SET_VAR]: disjucnct.value.iri};
}

function textDisjunct(config: SemanticSearchConfig, conjunct: Model.Conjunct) {
  const patternConfig = getConfigPatternForCategory(config, conjunct.range.iri) as Text;
  const escapeLuceneSyntax: boolean = !(patternConfig && patternConfig.escapeLuceneSyntax === false);
  return function(disjunct: Model.TextDisjunct) {
    const val = escapeLuceneSyntax ? SparqlUtil.makeLuceneQuery(disjunct.value) : Rdf.literal(disjunct.value);
    return {[SEMANTIC_SEARCH_VARIABLES.RESOURCE_VAR]: val};
 };
}


function dateDisjunct(disjunct: Model.DateDisjunct) {
  return {
    [SEMANTIC_SEARCH_VARIABLES.DATE_BEGING_VAR]: createDateLiteral(disjunct.value),
    [SEMANTIC_SEARCH_VARIABLES.DATE_END_VAR]: createDateLiteral(disjunct.value),
  };
}

function dateRangeDisjunct(disjunct: Model.DateRangeDisjunct) {
  return {
    [SEMANTIC_SEARCH_VARIABLES.DATE_BEGING_VAR]: createDateLiteral(disjunct.value.begin),
    [SEMANTIC_SEARCH_VARIABLES.DATE_END_VAR]: createDateLiteral(disjunct.value.end),
  };
}

function dateDeviationDisjunct(disjunct: Model.DateDeviationDisjunct) {
  const { date, deviation } = disjunct.value;
  return {
    [SEMANTIC_SEARCH_VARIABLES.DATE_BEGING_VAR]: createDateLiteral(
      date.clone().subtract(deviation, 'days')
    ),
    [SEMANTIC_SEARCH_VARIABLES.DATE_END_VAR]: createDateLiteral(
      date.clone().add(deviation, 'days')
    ),
  };
}

function yearDisjunct(disjunct: Model.YearDisjunct) {
  const { year, epoch } = disjunct.value;
  const yearValue = year * (epoch === 'AD' ? 1 : -1);
  const begin = moment({year: yearValue, month: 0, day: 1});
  const end = moment({year: yearValue, month: 11, day: 31});
  return {
    [SEMANTIC_SEARCH_VARIABLES.DATE_BEGING_VAR]: createDateLiteral(begin),
    [SEMANTIC_SEARCH_VARIABLES.DATE_END_VAR]: createDateLiteral(end),
  };
}

function yearRangeDisjunct(disjunct: Model.YearRangeDisjunct) {
  const { begin, end } = disjunct.value;
  const yearStartValue = begin.year * (begin.epoch === 'AD' ? 1 : -1);
  const beginValue = moment({year: yearStartValue, month: 0, day: 1});
  const yearEndValue = end.year * (end.epoch === 'AD' ? 1 : -1);
  const endValue = moment({year: yearEndValue, month: 11, day: 31});
  return {
    [SEMANTIC_SEARCH_VARIABLES.DATE_BEGING_VAR]: createDateLiteral(beginValue),
    [SEMANTIC_SEARCH_VARIABLES.DATE_END_VAR]: createDateLiteral(endValue),
  };
}

function yearDeviationDisjunct(disjunct: Model.YearDeviationDisjunct) {
  const { year, deviation } = disjunct.value;
  const yearValue = year.year * (year.epoch === 'AD' ? 1 : -1);
  const yearFullDate = moment({year: yearValue});
  const begin = yearFullDate.clone().startOf('year').subtract(deviation, 'years');
  const end = yearFullDate.clone().endOf('year').add(deviation, 'years');
  return {
    [SEMANTIC_SEARCH_VARIABLES.DATE_BEGING_VAR]: createDateLiteral(begin),
    [SEMANTIC_SEARCH_VARIABLES.DATE_END_VAR]: createDateLiteral(end),
  };
}

function distanceDisjunct(disjunct: Model.SpatialDistanceDisjunct) {
  return {
    [SEMANTIC_SEARCH_VARIABLES.GEO_CENTER_VAR]: coordToBlazegraphLiteral(disjunct.value.center),
    [SEMANTIC_SEARCH_VARIABLES.GEO_DISTANCE_VAR]: Rdf.literal(disjunct.value.distance),
  };
}

function boundingBoxDisjunct(disjunct: Model.SpatialBoundingBoxDisjunct) {
  return {
    [SEMANTIC_SEARCH_VARIABLES.GEO_SOUTH_WEST]: coordToBlazegraphLiteral(disjunct.value.southWest),
    [SEMANTIC_SEARCH_VARIABLES.GEO_NORTH_EAST]: coordToBlazegraphLiteral(disjunct.value.northEast),
  };
}

function literalDisjunct(disjunct: Model.LiteralDisjunct) {
  return {
    [SEMANTIC_SEARCH_VARIABLES.LITERAL_VAR]: disjunct.value.literal,
  };
}

function numericRangeDisjunct(disjunct: Model.NumericRangeDisjunct) {
  const doubleType = Rdf.iri('http://www.w3.org/2001/XMLSchema#double');
  return {
    [SEMANTIC_SEARCH_VARIABLES.NUMERIC_RANGE_BEGIN_VAR]: Rdf.literal('' + disjunct.value.begin, doubleType),
    [SEMANTIC_SEARCH_VARIABLES.NUMERIC_RANGE_END_VAR]: Rdf.literal('' + disjunct.value.end, doubleType),
  };
}

function createDateLiteral(date: moment.Moment): Rdf.Literal {
  return Rdf.literal(
    fixZeroYearIssue(date).format(XSD_DATE_FORMAT), vocabularies.xsd.date
  );
}

function coordToBlazegraphLiteral(coord: Model.Coordinate): Rdf.Literal {
  return Rdf.literal(`${coord.lat}#${coord.long}`);
}

/**
 * blazegraph uses RDF 1.0 specification, wihch refers to
 * - http://www.w3.org/TR/xmlschema-2/#year-zero
 * where 0000 year is invalid.
 *
 * Use of this method should be removed as soon as bigdata update to RDF 1.1,
 * where 0000 year is valid date - http://www.w3.org/TR/xmlschema11-2/#dateTime
 *
 * @see https://jira.blazegraph.com/browse/BLZG-1199
 */
function fixZeroYearIssue(date: moment.Moment) {
  return date.year() === 0 ? date.subtract(1, 'year') : date;
}

function disjunctToVariables(config: SemanticSearchConfig, conjunct: Model.Conjunct) {
  return Model.matchDisjunct({
    Resource: resourceDisjunct,
    Set: setDisjunct,
    Search: () => ({}),
    SavedSearch: () => ({}),
    Date: dateDisjunct,
    DateRange: dateRangeDisjunct,
    DateDeviation: dateDeviationDisjunct,
    Year: yearDisjunct,
    YearRange: yearRangeDisjunct,
    YearDeviation: yearDeviationDisjunct,
    Text: textDisjunct(config, conjunct),
    Distance: distanceDisjunct,
    BoundingBox: boundingBoxDisjunct,
    Literal: literalDisjunct,
    NumericRange: numericRangeDisjunct,
  });
}

/**
 * Extracts pattern configurations for the given relation from a search config
 * by looking into full relations list or ranges of categories.
 * @param config search configuration to look into
 * @param relation target relation to get patterns for
 * @param range relation range to use when looking into search categories
 */
export function tryGetRelationPatterns(
  config: SemanticSearchConfig,
  relation: Model.Relation,
  range = relation.hasRange
): PatternConfig[] {
  if (_.has(config.relations, relation.iri.toString())) {
    return config.relations[relation.iri.toString()];
  } else if (_.has(config.categories, range.iri.toString())) {
    return config.categories[range.iri.toString()];
  } else {
    return [];
  }
}

function getMatchingPattern(
  config: SemanticSearchConfig, projectionVariable: string,
  conjunct: Model.Conjunct, disjunct: Model.Disjunct
): string {
  const range = conjunct.range;
  return Model.matchConjunct({
    Relation: conj => {
      const relation = conj.relation;
      const patterns = tryGetRelationPatterns(config, relation, range);
      if (patterns.length === 0) {
        if (Model.isSetDisjunct(disjunct)) {
          return applySetPattern(DEFAULT_QUERY_PATTERN(projectionVariable), DEFAULT_SET_QUERY_PATTERN);
        } else {
          return DEFAULT_QUERY_PATTERN(projectionVariable);
        }
      }

      if (Model.isTemporalDisjunct(disjunct)) {
        return (_.find(patterns, pattern => pattern.kind = 'date-range') as DateRange).queryPattern;
      } else if (Model.isSpatialDisjunct(disjunct)) {
        switch (disjunct.kind) {
          case Model.SpatialDisjunctKinds.Distance:
            return _.find(patterns, pattern => pattern.kind === 'place')['distanceQueryPattern'];
          case Model.SpatialDisjunctKinds.BoundingBox:
            return _.find(patterns, pattern => pattern.kind === 'place')['boundingBoxQueryPattern'];
        }
      } else {
        const hierarchyPattern = _.find(patterns, pattern => pattern.kind === 'hierarchy') as Hierarchy;
        const resourcePattern = _.find(patterns, pattern => pattern.kind === 'resource') as Resource;
        const setPattern = _.find(patterns, pattern => pattern.kind === 'set') as Set;
        const literalPattern = _.find(patterns, pattern => pattern.kind === 'literal') as Literal;
        const numericRangePattern = _.find(patterns, pattern => pattern.kind === 'numeric-range') as NumericRange;

        if (Model.isSetDisjunct(disjunct)) {
          if (hierarchyPattern) {
            return applySetPattern(
              hierarchyPattern.queryPattern,
              setPattern ? setPattern.queryPattern : DEFAULT_SET_QUERY_PATTERN
            );
          } else if (resourcePattern) {
            return applySetPattern(
              resourcePattern.queryPattern,
              setPattern ? setPattern.queryPattern : DEFAULT_SET_QUERY_PATTERN
            );
          } else {
            return applySetPattern(
              DEFAULT_QUERY_PATTERN(projectionVariable), DEFAULT_SET_QUERY_PATTERN
            );
          }

        } else {
          if (hierarchyPattern) {
            return hierarchyPattern.queryPattern;
          } else if (resourcePattern) {
            return resourcePattern.queryPattern;
          } else if (literalPattern) {
            return literalPattern.queryPattern;
          } else if (numericRangePattern) {
            return numericRangePattern.queryPattern;
          } else {
            return DEFAULT_QUERY_PATTERN(projectionVariable);
          }
        }
      }
    },
    Text: () => (getConfigPatternForCategory(config, range.iri) as Text).queryPattern,
  })(conjunct);
}

/**
 * Because in blazegraph we disable re-ordering of statements
 * setPattern should be applied before relationPattern to
 * avoid huge join in big datasets
 */
function applySetPattern(relationPattern: string, setPattern: string): string {
  return setPattern + relationPattern;
}

function getGenericVariables(domain: Model.Category, conjunct: Model.Conjunct) {
  return Model.matchConjunct({
    Relation: conj => ({
      [SEMANTIC_SEARCH_VARIABLES.DOMAIN_VAR]: domain.iri,
      [SEMANTIC_SEARCH_VARIABLES.RANGE_VAR]: conj.range.iri,
      [SEMANTIC_SEARCH_VARIABLES.RELATION_VAR]: conj.relation.iri,
    }),
    Text: () => ({[SEMANTIC_SEARCH_VARIABLES.DOMAIN_VAR]: domain.iri}),
  })(conjunct);
}

function parseQueryPattern(queryPattern: string, projectionVariable: string): SparqlJs.SelectQuery {
  const query = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(`SELECT * {{ ${queryPattern} }}`);
  return rewriteProjectionVariable(query, projectionVariable);
}

class Randomizer extends QueryVisitor {
  private variablesMap: {[key: string]: string} = {};
  private subjectVariable: string;
  private rewriteSubjectVariable: SparqlJs.Term;

  constructor(subjectVariable: string, rewriteSubjectVariable?: string) {
    super();
    this.subjectVariable = subjectVariable;
    this.rewriteSubjectVariable = rewriteSubjectVariable as SparqlJs.Term;
  }

  variableTerm(variable: SparqlJs.Term): SparqlJs.Term {
    if (variable === this.subjectVariable) {
      return this.rewriteSubjectVariable ? this.rewriteSubjectVariable : variable;
    }

    if (!_.has(this.variablesMap, variable)) {
      this.variablesMap[variable] = variable + '_' + uuid.v4().replace(/-/g, '_');
    }
    return this.variablesMap[variable] as SparqlJs.Term;
  }
}

function randomizeVariables(
  query: SparqlJs.SelectQuery, subjectVariable: string, rewriteSubjectVariable?: string
): SparqlJs.SelectQuery {
  (new Randomizer(subjectVariable, rewriteSubjectVariable)).query(query);
  return query;
}

export function disjunctToQueryPattern(
  config: SemanticSearchConfig, projectionVariable: string, domain: Model.Category
) {
  return function(
    conjunct: Model.RelationConjunct
  ) {
    return function(disjunct: Model.Disjunct): SparqlJs.Pattern {
      if (disjunct.kind === Model.EntityDisjunctKinds.Search) {
        return complexDisjunctToQueryPattern(config, projectionVariable, domain, conjunct, disjunct);
      } if (disjunct.kind === Model.EntityDisjunctKinds.SavedSearch) {
        return nestedQueryPattern(
          config, projectionVariable, domain, disjunct.value.query, conjunct, disjunct
        );
      } else {
        return simpleDisjunctToQueryPattern(config, projectionVariable, domain, conjunct, disjunct);
      }
    };
  };
}

function complexDisjunctToQueryPattern(
  config: SemanticSearchConfig, projectionVariable: string, domain: Model.Category,
  conjunct: Model.RelationConjunct, disjunct: Model.SearchDisjunct
) {
  const nestedQuery = generateSelectQueryPattern(projectionVariable, config, disjunct.value);
  return nestedQueryPattern(config, projectionVariable, domain, nestedQuery, conjunct, disjunct);
}

function nestedQueryPattern(
  config: SemanticSearchConfig, projectionVariable: string,
  domain: Model.Category, nestedQuery: SparqlJs.SelectQuery,
  conjunct: Model.RelationConjunct, disjunct: Model.Disjunct
) {
  const patternQuery = simpleDisjunctPatternQuery(
    config, projectionVariable, domain, conjunct, disjunct
  );
  const patterns = patternQuery.where;
  patterns.unshift(
    ...randomizeVariables(
     nestedQuery, projectionVariable, '?' + SEMANTIC_SEARCH_VARIABLES.RESOURCE_VAR
    ).where
  );
  patternQuery.where = [{'type': 'group', patterns: patterns}];
  return randomizeVariables(patternQuery, projectionVariable).where[0];
}


function simpleDisjunctToQueryPattern(
  config: SemanticSearchConfig, projectionVariable: string,
  domain: Model.Category, conjunct: Model.RelationConjunct, disjunct: Model.Disjunct
) {
  const patternQuery = simpleDisjunctPatternQuery(
    config, projectionVariable, domain, conjunct, disjunct
  );
  return randomizeVariables(patternQuery, projectionVariable).where[0];
}

function simpleDisjunctPatternQuery(
  config: SemanticSearchConfig, projectionVariable: string,
  domain: Model.Category, conjunct: Model.Conjunct, disjunct: Model.Disjunct
): SparqlJs.SelectQuery {
  const pattern = getMatchingPattern(config, projectionVariable, conjunct, disjunct);
  const parsedPattern = parseQueryPattern(pattern, projectionVariable);
  const parameters =
    _.assign(
      getGenericVariables(domain, conjunct),
      disjunctToVariables(config, conjunct)(disjunct)
    );
  return SparqlClient.setBindings(parsedPattern, parameters);
}

export function conjunctToQueryPattern(
  config: SemanticSearchConfig, projectionVariable: string,
  domain: Model.Category
) {
  return function(conjunct: Model.RelationConjunct): SparqlJs.Pattern {
    const patterns = _.map(
      conjunct.disjuncts, disjunctToQueryPattern(config, projectionVariable, domain)(conjunct)
    );
    const flattenedPatterns =
      _.map(patterns, pattern => {
        if (SparqlTypeGuards.isBlockPattern(pattern) && pattern.patterns.length === 1) {
          return pattern.patterns[0];
        } else {
          return pattern;
        }
      });

    if (flattenedPatterns.length === 1) {
      return flattenedPatterns[0];
    } else {
      return {
        'type': 'union',
        'patterns': flattenedPatterns,
      };
    }
  };
}

export function conjunctsToQueryPatterns(
  config: SemanticSearchConfig, projectionVariable: string,
  domain: Model.Category, conjuncts: Array<Model.RelationConjunct>
): Array<SparqlJs.Pattern> {
  const patterns = _.map(conjuncts, conjunctToQueryPattern(config, projectionVariable, domain));
  return _.flatten(
    _.map(patterns, pattern => {
      if (SparqlTypeGuards.isGroupPattern(pattern)) {
        return pattern.patterns;
      } else {
        return pattern;
      }
    })
  );
}

function generateSelectQueryPattern(
  projectionVariable: string, config: SemanticSearchConfig, search: Model.Search
): SparqlJs.SelectQuery {
  const patterns = conjunctsToQueryPatterns(
    config, projectionVariable, search.domain, search.conjuncts as Array<Model.RelationConjunct>
  );
  return {
    prefixes: {},
    type: 'query',
    'queryType': 'SELECT',
    'variables': [projectionVariable as SparqlJs.Term],
    'where': patterns,
  };
}

/**
 * In all configuration queries it is possible to refer to main result projection variable with ?subject alias, order to apply these queries to any base query
 * we need to properly re-write ?subject to actual projection variable from the base query
 */
export function rewriteProjectionVariable(
  query: SparqlJs.SelectQuery, projectionVariable: string
): SparqlJs.SelectQuery {
  const result = cloneQuery(query);
  (new class extends QueryVisitor {
    variableTerm(variable: SparqlJs.Term): SparqlJs.Term {
      if (variable.substring(1) === SEMANTIC_SEARCH_VARIABLES.PROJECTION_ALIAS_VAR) {
        return projectionVariable as SparqlJs.Term;
      }
    }
  }).query(result);
  return result;
}

export function generateSelectQuery(
  config: SemanticSearchConfig, projectionVariableName: string, search: Model.Search
): SparqlJs.SelectQuery {
  const projectionVariable = '?' + projectionVariableName;
  const patterns = conjunctsToQueryPatterns(
    config, projectionVariable, search.domain, search.conjuncts as Array<Model.RelationConjunct>
  );
  return {
    prefixes: {},
    type: 'query',
    'queryType': 'SELECT',
    distinct: true,
    'variables': [projectionVariable as SparqlJs.Term],
    'where': patterns,
    'limit': config.limit,
  };
}

export function blazegraphNoOptimizePattern(): SparqlJs.Pattern {
  return {
    type: 'bgp',
    triples: [{
      subject: 'http://www.bigdata.com/queryHints#Query' as SparqlJs.Term,
      predicate: 'http://www.bigdata.com/queryHints#optimizer' as SparqlJs.Term,
      object: '"None"' as SparqlJs.Term,
    }],
  };
}
