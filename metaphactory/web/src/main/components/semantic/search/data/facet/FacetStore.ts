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

import * as maybe from 'data.maybe';
import * as _ from 'lodash';
import * as Kefir from 'kefir';
import * as Immutable from 'immutable';
import * as moment from 'moment';

import { Rdf } from 'platform/api/rdf';
import {
  SparqlUtil, SparqlClient, PatternBinder, VariableRenameBinder, QueryVisitor,
} from 'platform/api/sparql';
import { Action } from 'platform/components/utils';
import { SemanticContext } from 'platform/api/components';

import {
  SemanticFacetConfig, SemanticSearchConfig, SEMANTIC_SEARCH_VARIABLES, FACET_VARIABLES,
  FacetValuePattern, DateRangeFacetValue, LiteralFacetValue, NumericRangeFacetValue,
  ResourceFacetValue,
} from '../../config/SearchConfig';
import * as SearchConfig from '../../config/SearchConfig';
import * as SearchDefaults from '../../config/Defaults';
import { Resource } from '../Common';
import { Category, Relation, Categories, Relations } from '../profiles/Model';
import * as F from './Model';
import * as SearchModel from '../search/Model';
import SearchProfileStore from '../profiles/SearchProfileStore';
import {
  conjunctsToQueryPatterns, tryGetRelationPatterns, rewriteProjectionVariable,
} from '../search/SparqlQueryGenerator';

export interface FacetStoreConfig {
  domain: Category,
  baseQuery: SparqlJs.SelectQuery;
  initialAst: F.Ast;
  config: SemanticFacetConfig;
  baseConfig: SemanticSearchConfig;
  searchProfileStore: SearchProfileStore;
}

export interface FacetData {
  categories: Categories;
  relations: Relations;
  viewState: FacetViewState;
  ast: F.Ast;
}

export interface FacetViewState {
  category: Data.Maybe<Category>
  categoryTemplate: string
  relation: Data.Maybe<Relation>
  relationTemplate: string
  values: Array<F.FacetValue>
  valuesTemplate: {resource: string, literal: string}
  relationType: 'resource' | 'date-range' | 'literal' | 'numeric-range'
  selectorMode: 'stack' | 'dropdown'
}

export interface Actions {
  /**
   * Action which is triggered when user use category filter.
   */
  toggleCategory: (category: Category) => void

  /**
   * Action which is triggered when user collapse/expands facet relation.
   */
  toggleRelation: (relation: Relation) => void

  setFacetValue: (relation: Relation) => (value: F.FacetValue) => void

  /**
   * Action which is triggered when user removes all selected facets for relation.
   */
  removeConjunct: (conjunct: SearchModel.RelationConjunct) => void
}

interface FacetQueries {
  baseQuery: SparqlJs.SelectQuery
  categoriesQuery: SparqlJs.SelectQuery
  relationsQuery: SparqlJs.SelectQuery
}

const blazegraphOptimizerPriorRunFirstClause = {
        type: 'bgp',
        triples: [ {
            subject: 'http://www.bigdata.com/queryHints#Prior' as SparqlJs.Term,
            predicate: 'http://www.bigdata.com/queryHints#runFirst' as SparqlJs.Term,
            object: '"true"' as SparqlJs.Term,
        } as SparqlJs.Triple],
    } as SparqlJs.BgpPattern;

/**
 * This class contains all logic for facet components.
 * The idea is to keep React components logic free and in spirit of React Flux.
 *
 * @see https://facebook.github.io/flux/docs/overview.html
 */
export class FacetStore {
  private context: SemanticContext;
  private config: FacetStoreConfig;
  private queries: FacetQueries;

  /**
   * Property which contains current state of the facet at any given point in time.
   */
  private ast: F.Ast;

  /**
   * Property which contains all data required for facet rendering.
   * This property is updated on:
   *   - facet selections change
   *   - base query update
   */
  private facetData = Action<FacetData>();

  private facetedQuery = Action<SparqlJs.SelectQuery>();

  private facetView: FacetViewState;

  private actions: Actions;

  constructor(config: FacetStoreConfig, context: SemanticContext) {
    this.context = context;
    this.config = config;
    this.ast = config.initialAst || {conjuncts: []};

    this.facetView = {
      category: maybe.Nothing<Category>(),
      categoryTemplate: config.config.categories.tupleTemplate,
      relation: maybe.Nothing<Relation>(),
      relationTemplate: config.config.relations.tupleTemplate,
      values: [],
      valuesTemplate: config.config.defaultValueTemplate,
      relationType: 'resource',
      selectorMode: config.baseConfig.selectorMode,
    };

    const baseQuery = _.clone(this.config.baseQuery);
    // cleanup prefixes in the base query because it will be used as sub-query in other queries
    baseQuery.prefixes = {};

    const projectionVariable = this.getProjectionVariable(baseQuery);
    this.queries = {
      baseQuery: baseQuery,
      categoriesQuery: rewriteProjectionVariable(
        SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(config.config.categories.query),
        projectionVariable
      ),
      relationsQuery: rewriteProjectionVariable(
        SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(config.config.relations.query),
        projectionVariable
      ),
    };

    this.actions = {
      toggleCategory: this.toggleCategory,
      toggleRelation: this.toggleRelation,
      setFacetValue: this.setFacetValue,
      removeConjunct: this.removeConjunct,
    };

    this.reCreateAllFacetData(
      this.facetView, this.queries
    ).onValue(
      data => this.facetData(data)
    );
  }

  private updateViewFacetData(
    conjuncts: F.Conjuncts, viewState: FacetViewState, oldViewState: FacetViewState, facetData: Kefir.Property<FacetData>,
    queries: FacetQueries
  )  {
    const baseQuery = queries.baseQuery;

    if (!_.isEqual(oldViewState.category, viewState.category)) {
      // if only selected category changed, recompute only facet relations for category
      const categories = facetData.map(fd => fd.categories);
      const relations = this.fetchRelations(
        baseQuery, conjuncts, viewState.category, queries.relationsQuery
      );
      this.createFacetData(
        this.ast, viewState, categories, relations
      ).onValue(
        this.facetData
      );
    } else {
      // if only selected relation changed, recompute only facet values for relation
      const categories = facetData.map(fd => fd.categories);
      const relations = facetData.map(fd => fd.relations);
      this.createFacetData(
        this.ast, viewState, categories, relations
      ).onValue(
        this.facetData
      );
    }
  }

  private reCreateAllFacetData(
    viewState: FacetViewState, queries: FacetQueries
  ) {
    this.facetedQuery(
      this.generateQuery(queries.baseQuery, this.ast.conjuncts)
    );

    const categories = this.fetchCategories(
      queries.baseQuery, this.ast.conjuncts, viewState.category, queries.categoriesQuery
    );
    const relations = this.fetchRelations(
      queries.baseQuery, this.ast.conjuncts, viewState.category, queries.relationsQuery
    );
    return this.createFacetData(
      this.ast, viewState, categories, relations
    );
  }

  private createFacetData(
    ast: F.Ast, viewState: FacetViewState,
    categories: Kefir.Property<Categories>, relations: Kefir.Property<Relations>
  ): Kefir.Property<FacetData> {
    return Kefir.zip([
      categories,
      relations,
      viewState.relation.map(
        relation => {
          return this.fetchFacetValues(ast.conjuncts, relation).map(
            values => {
              viewState.values = values;
              viewState.relationType = this.getFacetValuesQueryForRelation(this.config, relation).kind as any;
              return viewState;
            }
          );
        }
      ).getOrElse(Kefir.constant(viewState)),
    ]).map(
      ([cs, rs, vs]) =>
        ({
          categories: cs,
          relations: rs,
          viewState: vs,
          ast: ast,
        })
    ).toProperty();
  }

  getFacetedQuery(): Kefir.Property<SparqlJs.SelectQuery> {
    return this.facetedQuery.$property;
  }

  getFacetAst(): F.Ast {
    return this.ast;
  }

  getFacetData() {
    return this.facetData.$property;
  }

  facetActions() {
    return this.actions;
  }

  private toggleCategory = (category: Category) => {
    const isToggleOff =
      this.facetView.category.map(c => c.iri.equals(category.iri)).getOrElse(false);
    const oldViewState = _.cloneDeep(this.facetView);
    this.facetView.category = isToggleOff ? maybe.Nothing<Category>() : maybe.Just(category);
    this.updateViewFacetData(
      this.ast.conjuncts, this.facetView, oldViewState, this.facetData.$property, this.queries
    );
  }

  private toggleRelation = (relation: Relation) => {
    const isToggleOff = this.facetView.relation.map(
      r => r.iri.equals(relation.iri)
    ).getOrElse(false);
    const oldViewState = _.cloneDeep(this.facetView);
    this.facetView.relation = isToggleOff ? maybe.Nothing<Relation>() : maybe.Just(relation);
    this.updateViewFacetData(
      this.ast.conjuncts, this.facetView, oldViewState, this.facetData.$property, this.queries
    );
  }

  private setFacetValue = (relation: Relation) =>
    (value: F.FacetValue) => {
      switch (this.facetView.relationType) {
        case 'resource': this.toggleResourceValue(relation, value as Resource); break;
        case 'date-range': this.setDateRangeValue(relation, value as F.DateRange); break;
        case 'literal': this.toggleLiteralValue(relation, value as F.Literal); break;
        case 'numeric-range': this.setNumericRangeValue(relation, value as F.NumericRange); break;
      }
      this.recalculateFacets();
    }

  private toggleResourceValue(relation: Relation, resource: Resource) {
    const { conjuncts } = this.ast;
    const conjunct = _.find(conjuncts, cn => cn.relation.iri.equals(relation.iri));
    if (conjunct) {
      const disjuncts = conjunct.disjuncts;
      const hasValue = _.some(disjuncts, d => (d.value as Resource).iri.equals(resource.iri));
      if (hasValue) {
        _.remove(disjuncts, d => (d.value as Resource).iri.equals(resource.iri));
      } else {
        disjuncts.push({
          kind: SearchModel.EntityDisjunctKinds.Resource,
          disjunctIndex: [conjunct.conjunctIndex[0], disjuncts.length],
          value: resource,
        });
      }
    } else {
      this.ast.conjuncts.push({
        kind: SearchModel.ConjunctKinds.Relation,
        conjunctIndex: [conjuncts.length],
        relation: relation,
        range: relation.hasRange,
        disjuncts: [{
          kind: SearchModel.EntityDisjunctKinds.Resource,
          disjunctIndex: [conjuncts.length, 0],
          value: resource,
        }],
      });
    }
  }

  private toggleLiteralValue(relation: Relation, literal: F.Literal) {
    const {conjuncts} = this.ast;
    const conjunct = _.find(conjuncts, cn => cn.relation.iri.equals(relation.iri));
    if (conjunct) {
      const disjuncts = conjunct.disjuncts;
      const hasValue = _.some(
        disjuncts, d => (d.value as F.Literal).literal.equals(literal.literal)
      );
      if (hasValue) {
        _.remove(
          disjuncts, d => (d.value as F.Literal).literal.equals(literal.literal)
        );
      } else {
        disjuncts.push({
          kind: SearchModel.LiteralDisjunctKind,
          disjunctIndex: [conjunct.conjunctIndex[0], disjuncts.length],
          value: literal,
        });
      }
    } else {
      this.ast.conjuncts.push({
        kind: SearchModel.ConjunctKinds.Relation,
        conjunctIndex: [conjuncts.length],
        relation: relation,
        range: relation.hasRange,
        disjuncts: [{
          kind: SearchModel.LiteralDisjunctKind,
          disjunctIndex: [conjuncts.length, 0],
          value: literal,
        }],
      });
    }
  }

  private setNumericRangeValue(relation: Relation, numericRange: F.NumericRange) {
    const { conjuncts } = this.ast;
    const conjunct = _.find(conjuncts, cn => cn.relation.iri.equals(relation.iri));
    if (conjunct) {
      conjunct.disjuncts.length = 0;
      conjunct.disjuncts.push({
        kind: SearchModel.NumericRangeDisjunctKind,
        disjunctIndex: [conjunct.conjunctIndex[0], 0],
        value: numericRange,
      });
    } else {
      this.ast.conjuncts.push({
        kind: SearchModel.ConjunctKinds.Relation,
        conjunctIndex: [conjuncts.length],
        relation: relation,
        range: relation.hasRange,
        disjuncts: [{
          kind: SearchModel.NumericRangeDisjunctKind,
          disjunctIndex: [conjuncts.length, 0],
          value: numericRange,
        }],
      });
    }
  }

  private setDateRangeValue(relation: Relation, dateRange: F.DateRange) {
    const { conjuncts } = this.ast;
    const conjunct = _.find(conjuncts, cn => cn.relation.iri.equals(relation.iri));
    if (conjunct) {
      conjunct.disjuncts.length = 0;
      conjunct.disjuncts.push({
        kind: SearchModel.TemporalDisjunctKinds.DateRange,
        disjunctIndex: [conjunct.conjunctIndex[0], 0],
        value: dateRange,
      });
    } else {
      this.ast.conjuncts.push({
        kind: SearchModel.ConjunctKinds.Relation,
        conjunctIndex: [conjuncts.length],
        relation: relation,
        range: relation.hasRange,
        disjuncts: [{
          kind: SearchModel.TemporalDisjunctKinds.DateRange,
          disjunctIndex: [conjuncts.length, 0],
          value: dateRange,
        }],
      });
    }
  }

  private removeConjunct = (conjunct: SearchModel.RelationConjunct) => {
    _.remove(this.ast.conjuncts, c => c.relation.iri.equals(conjunct.relation.iri));
    this.recalculateFacets();
  }


  private recalculateFacets() {
    this.reCreateAllFacetData(this.facetView, this.queries).onValue(
      data => this.facetData(data)
    );
  }

  /**
   * Execute SPARQL query to fetch categories for facet.
   */
  private fetchCategories(
    baseQuery: SparqlJs.SelectQuery, conjuncts: F.Conjuncts,
    selectedCategory: Data.Maybe<Category>, categoriesQuery: SparqlJs.SelectQuery
  ): Kefir.Property<Categories> {
    const categories = this.config.searchProfileStore.ranges;
    const query = this.buildCategoriesQuery(baseQuery, conjuncts, categoriesQuery);
    const params = categories.keySeq().map(iri => ({[FACET_VARIABLES.RANGE_VAR]: iri})).toJS();

    return SparqlClient.select(
      SparqlClient.prepareParsedQuery(params)(query), {context: this.context.semanticContext}
    ).map(
      res =>
        categories.map(
          category =>
            this.buildFacetCategoryBinding(res.results.bindings, category)
        )
    );
  }

  private buildCategoriesQuery(
    baseQuery: SparqlJs.SelectQuery, conjuncts: F.Conjuncts, categoriesQuery: SparqlJs.SelectQuery
  ) {
    categoriesQuery = _.cloneDeep(categoriesQuery);
    categoriesQuery.where.unshift(
      ...this.generateQueryClause(conjuncts)
    );
    // the base query should be executed first, if we use the blazegraph optimizer
    if (this.config.baseConfig.optimizer === 'blazegraph') {
        // since we are using unshift here, the runFirst clause will appear immediately
        // _after_ the base query in the rendered query
        categoriesQuery.where.unshift( blazegraphOptimizerPriorRunFirstClause );
    }
    categoriesQuery.where.unshift(baseQuery);
    return categoriesQuery;
  }

  private fetchRelations(
    baseQuery: SparqlJs.SelectQuery, conjuntcs: F.Conjuncts,
    maybeCategory: Data.Maybe<Category>, relationsQuery: SparqlJs.SelectQuery
  ): Kefir.Property<Relations> {
    const query = _.cloneDeep(relationsQuery);
    // the base query should be executed first, if we use the blazegraph optimizer
    if (this.config.baseConfig.optimizer === 'blazegraph') {
        // since we are using unshift here, the runFirst clause will appear immediately
        // _after_ the base query in the rendered query
        query.where.unshift(blazegraphOptimizerPriorRunFirstClause);
    }
    query.where.unshift(baseQuery);
    query.where = query.where.concat(
      this.generateQueryClause(conjuntcs)
    );

    const relations =
      this.config.searchProfileStore.relationsFor({
        domain: maybe.Just(this.config.domain),
        range: maybeCategory,
      });
    const categories = this.config.searchProfileStore.domains;
    const params = relations.keySeq().map(iri => ({[FACET_VARIABLES.RELATION_VAR]: iri})).toJS();
    return SparqlClient.select(
      SparqlClient.prepareParsedQuery(params)(query), {context: this.context.semanticContext}
    ).map(
      results => this.buildFacetRelationBindings(results.results.bindings, relations, categories)
    );
  }

  /**
   * Makes bindings for category from search profile, available at '$category' varibale, in the
   * tuple for Facet category item.
   */
  private buildFacetCategoryBinding(
    originalBindings: SparqlClient.Bindings, category: Category
  ): Category {
    return maybe.fromNullable(
      _.find(originalBindings, binding =>
             category.iri.equals(binding[this.config.config.categories[FACET_VARIABLES.RANGE_VAR]])
            )
    ).map(
      additionalBindings =>
        _.set<Category>(
          _.cloneDeep(category), 'tuple',
          _.assign({'$category': category.tuple}, additionalBindings)
        )
    ).getOrElse(
      _.set<Category>(_.cloneDeep(category), 'tuple', _.assign({'$category': category.tuple}))
    );
  }

  /**
   * Makes bindings from search profile, available in the tuple for Facet relation item.
   *
   * $relation - for relation tuple
   * $domain - for relation domain category
   * $range - for relation range category
   */
  private buildFacetRelationBindings(
    originalBindings: SparqlClient.Bindings, relations: Relations, categories: Categories
  ): Relations {
    const facetRelations =
      originalBindings.map(
        binding => {
          const relation = this.findRelationForBinding(relations, binding);
          if (!relation) { return undefined; }
          const domain = relation.hasDomain;
          const range = relation.hasRange;
          return [
            relation.iri,
            _.set(
              _.cloneDeep(relation), 'tuple',
              _.assign(
                {
                  '$relation': relation.tuple,
                  '$domain': domain.tuple,
                  '$range': range.tuple,
                }, binding
              )
            ),
          ];
        }
      ).filter(relation => relation !== undefined);
    return Immutable.OrderedMap<Rdf.Iri, Relation>(facetRelations);
  }

  private findRelationForBinding(relations: Relations, binding: SparqlClient.Binding): Relation {
    return relations.find(
      relation => relation.iri.equals(binding[FACET_VARIABLES.RELATION_VAR])
    );
  }

  private fetchFacetValues(
    conjuncts: F.Conjuncts, relation: Relation
  ): Kefir.Property<Array<F.FacetValue>> {
    const relationConfig = this.getFacetValuesQueryForRelation(this.config, relation);
    switch (relationConfig.kind) {
      case 'resource': return this.fetchFacetResourceValues(conjuncts, relation, relationConfig);
      case 'date-range': return this.fetchFacetDateRangeValues(conjuncts, relation, relationConfig);
      case 'literal': return this.fetchFacetLiteralValues(conjuncts, relation, relationConfig);
      case 'numeric-range': return this.fetchFacetNumericRangeValues(conjuncts, relation, relationConfig);
    }
  }

  private fetchFacetResourceValues(
    conjuncts: F.Conjuncts, relation: Relation, relationConfig: ResourceFacetValue
  ): Kefir.Property<Array<Resource>> {
    return this.executeValuesQuery(conjuncts, relation, relationConfig.valuesQuery).map(
      res => res.results.bindings.map(
        binding => ({
          iri: binding[FACET_VARIABLES.VALUE_RESOURCE_VAR] as Rdf.Iri,
          label: binding[FACET_VARIABLES.VALUE_RESOURCE_LABEL_VAR].value,
          description: binding[FACET_VARIABLES.VALUE_RESOURCE_LABEL_VAR].value,
          tuple: binding,
        })
      )
    );
  }

  private fetchFacetDateRangeValues(
    conjuncts: F.Conjuncts, relation: Relation, relationConfig: DateRangeFacetValue
  ): Kefir.Property<Array<F.DateRange>> {
    return this.executeValuesQuery(conjuncts, relation, relationConfig.valuesQuery).map(
      res => res.results.bindings.map(
        binding => ({
          begin: moment(
            binding[FACET_VARIABLES.VALUE_DATE_RANGE_BEGIN_VAR].value, moment.ISO_8601
          ),
          end: moment(
            binding[FACET_VARIABLES.VALUE_DATE_RANGE_END_VAR].value, moment.ISO_8601
          ),
        })
      ).filter(({begin, end}) => begin.isValid() && end.isValid())
    );
  }

  private fetchFacetLiteralValues(
    conjuncts: F.Conjuncts, relation: Relation, relationConfig: LiteralFacetValue
  ): Kefir.Property<Array<F.Literal>> {
    return this.executeValuesQuery(conjuncts, relation, relationConfig.valuesQuery).map(
      res => res.results.bindings.map(
        binding => ({
          literal: binding[FACET_VARIABLES.VALUE_LITERAL] as Rdf.Literal,
          tuple: binding,
        })
      )
    );
  }

  private fetchFacetNumericRangeValues(
    conjuncts: F.Conjuncts, relation: Relation, relationConfig: NumericRangeFacetValue
  ): Kefir.Property<Array<F.NumericRange>> {
    return this.executeValuesQuery(conjuncts, relation, relationConfig.valuesQuery).map(
      res => res.results.bindings.map(
        binding => ({
          begin: parseFloat(binding[FACET_VARIABLES.VALUE_LITERAL].value),
          end: parseFloat(binding[FACET_VARIABLES.VALUE_LITERAL].value),
          tuple: binding,
        })
      )
    );
  }


  private executeValuesQuery(
    conjuncts: F.Conjuncts, relation: Relation, facetValuesQuery: string
  ) {
    const facetsQuery = rewriteProjectionVariable(
      SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(facetValuesQuery),
      this.getProjectionVariable(this.queries.baseQuery)
    );
    // the base query should be executed first, if we use the blazegraph optimizer
    if (this.config.baseConfig.optimizer === 'blazegraph') {
      // since we are using unshift here, the runFirst clause will appear immediately
      // _after_ the base query in the rendered query
      facetsQuery.where.unshift( blazegraphOptimizerPriorRunFirstClause );
    }
    facetsQuery.where.unshift(this.queries.baseQuery);
    facetsQuery.where = facetsQuery.where.concat(
      this.generateQueryClause(
        this.excludeClauseForRelation(conjuncts, relation.iri)
      )
    );

    const query =
      SparqlClient.setBindings(
        facetsQuery, {
          [FACET_VARIABLES.RELATION_VAR]: relation.iri,
        }
      );

    return SparqlClient.select(query, {context: this.context.semanticContext});
  }

  private excludeClauseForRelation(conjuncts: F.Conjuncts, relation: Rdf.Iri) {
    return _.reject(conjuncts, conjunct => conjunct.relation.iri.equals(relation));
  }

  private generateQuery(baseQuery: SparqlJs.SelectQuery, conjuncts: F.Conjuncts): SparqlJs.SelectQuery {
    const patterns = this.generateQueryClause(conjuncts);
    const query = _.clone(baseQuery);
    query.where = query.where.concat(patterns);
    return query;
  }

  private getFacetValuesQueryForRelation(
    config: FacetStoreConfig, relation: Relation
  ): FacetValuePattern {
    const { valueCategories, valueRelations } = config.config;
    const relationIri = relation.iri.toString();
    const rangeIri = relation.hasRange.iri.toString();
    if (_.has(valueRelations, relationIri)) {
      return valueRelations[relationIri];
    } else if (_.has(valueCategories, rangeIri)) {
      return valueCategories[rangeIri];
    } else {
      return generateFacetValuePatternFromRelation(config, relation);
    }
  }

  private getProjectionVariable(baseQuery: SparqlJs.SelectQuery): string {
    const variables = baseQuery.variables;
    return variables[0] as string;
  }

  private generateQueryClause(
    conjuncts: F.Conjuncts
  ): Array<SparqlJs.Pattern> {
    return conjunctsToQueryPatterns(
      this.config.baseConfig, this.getProjectionVariable(this.queries.baseQuery),
      this.config.domain, conjuncts
    );
  }
}

/**
 * Supported subset of relation kinds for facet value pattern autogeneration.
 */
type PatterConfig = SearchConfig.Resource | SearchConfig.Literal;
type PatternKind = PatterConfig['kind'];

/**
 * Generates a default query for facet values using {@link SemanticFacetConfig.defaultValueQuery}
 * as base template and parametrizes it with relation pattern.
 */
function generateFacetValuePatternFromRelation(
  config: FacetStoreConfig, relation: Relation
): FacetValuePattern {
  const relationPatterns = tryGetRelationPatterns(config.baseConfig, relation)
    .filter(p => p.kind === 'resource' || p.kind === 'literal') as PatterConfig[];

  const patternConfig = relationPatterns.length === 1 ? relationPatterns[0] : undefined;
  if (relationPatterns.length > 1) {
    console.warn(`Found multiple matching patterns for facet relation ${relation.iri}`);
  }

  let {kind = 'resource', queryPattern} = patternConfig || ({} as Partial<PatterConfig>);
  if (queryPattern === undefined) {
    queryPattern = (
      kind === 'resource' ? SearchDefaults.DefaultFacetValuesQueries.ResourceRelationPattern :
      kind === 'literal' ? SearchDefaults.DefaultFacetValuesQueries.LiteralRelationPattern :
      assertHandledEveryPatternKind(kind)
    );
  }

  const query = SparqlUtil.parseQuery(getDefaultValuesQuery(config.config, kind));
  const parsed = SparqlUtil.parsePatterns(queryPattern, query.prefixes);

  const facetRelationPattern = transformRelationPatternForFacetValues(parsed, kind);
  new PatternBinder(FACET_VARIABLES.RELATION_PATTERN_VAR, facetRelationPattern)
    .sparqlQuery(query);

  const valuesQuery = SparqlUtil.serializeQuery(query);
  return (
    kind === 'resource' ? {kind: 'resource', valuesQuery} :
    kind === 'literal' ? {kind: 'literal', valuesQuery} :
    assertHandledEveryPatternKind(kind)
  );
}

function getDefaultValuesQuery(config: SemanticFacetConfig, kind: PatternKind) {
  const defaultQueries = SearchDefaults.DefaultFacetValuesQueries;
  return (
    kind === 'resource' ? (config.defaultValueQueries.resource || defaultQueries.forResource()) :
    kind === 'literal' ? (config.defaultValueQueries.literal || defaultQueries.forLiteral()) :
    assertHandledEveryPatternKind(kind)
  );
}

/**
 * Renames resource variable in the relation pattern
 * to use it as part of facet values query.
 */
function transformRelationPatternForFacetValues(pattern: SparqlJs.Pattern[], kind: PatternKind) {
  let binder: QueryVisitor;
  if (kind === 'resource') {
    binder = new VariableRenameBinder(
      SEMANTIC_SEARCH_VARIABLES.RESOURCE_VAR,
      FACET_VARIABLES.VALUE_RESOURCE_VAR);
  } else if (kind === 'literal') {
    binder = new VariableRenameBinder(
      SEMANTIC_SEARCH_VARIABLES.LITERAL_VAR,
      FACET_VARIABLES.VALUE_LITERAL);
  } else {
    assertHandledEveryPatternKind(kind);
  }

  const clonedPattern = _.cloneDeep(pattern);
  clonedPattern.forEach(p => binder.pattern(p));
  return clonedPattern;
}

function assertHandledEveryPatternKind(kind: never): never {
  throw new Error(`Unexpected pattern kind: ${kind}`);
}
