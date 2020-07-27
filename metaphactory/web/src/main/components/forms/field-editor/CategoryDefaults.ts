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

import { Rdf } from 'platform/api/rdf';
import { SparqlUtil, VariableBinder } from 'platform/api/sparql';

const ROOTS_QUERY = `
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT DISTINCT ?item ?label WHERE {
  ?item skos:inScheme ?__scheme__ .
  FILTER NOT EXISTS { ?item skos:broader ?parent . }
  ?item skos:prefLabel ?label .
} ORDER BY ?label`;

const CHILDREN_QUERY = `
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT DISTINCT ?item ?label ?hasChildren WHERE {
  ?item skos:broader ?parent .
  ?item skos:inScheme ?__scheme__ .
  ?item skos:prefLabel ?label .
  OPTIONAL { ?child skos:broader ?item . }
  BIND(bound(?child) as ?hasChildren)
} ORDER BY ?label`;

const PARENTS_QUERY = `
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
select distinct ?item ?parent ?parentLabel where {
  ?parent skos:inScheme ?__scheme__ .
  ?item skos:broader ?parent .
  ?parent skos:prefLabel ?parentLabel .
}`;

const SEARCH_QUERY = `
PREFIX bds: <http://www.bigdata.com/rdf/search#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT DISTINCT ?item ?label ?score ?hasChildren WHERE {
  ?item skos:inScheme ?__scheme__ .
  ?item skos:prefLabel ?label.
  ?label bds:search ?__token__ ;
         bds:minRelevance "0.3" ;
         bds:relevance ?score ;
         bds:matchAllTerms "true"  .
  OPTIONAL { ?child skos:broader ?item. }
  BIND(BOUND(?child) AS ?hasChildren)
}
ORDER BY DESC(?score) ?label
LIMIT 200`;

export interface CategoryQueries {
  readonly rootsQuery: string;
  readonly childrenQuery: string;
  readonly parentsQuery: string;
  readonly searchQuery: string;
}

export function createDefaultCategoryQueries(scheme: Rdf.Iri): CategoryQueries {
  const rootsQuery = SparqlUtil.parseQuery(ROOTS_QUERY);
  const childrenQuery = SparqlUtil.parseQuery(CHILDREN_QUERY);
  const parentsQuery = SparqlUtil.parseQuery(PARENTS_QUERY);
  const searchQuery = SparqlUtil.parseQuery(SEARCH_QUERY);

  const queries = [rootsQuery, childrenQuery, parentsQuery, searchQuery];
  const binder = new VariableBinder({__scheme__: scheme});
  for (const query of queries) {
    binder.sparqlQuery(query);
  }

  return {
    rootsQuery: SparqlUtil.serializeQuery(rootsQuery),
    childrenQuery: SparqlUtil.serializeQuery(childrenQuery),
    parentsQuery: SparqlUtil.serializeQuery(parentsQuery),
    searchQuery: SparqlUtil.serializeQuery(searchQuery),
  };
}
