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

import { invert } from 'lodash';
import { compressToEncodedURIComponent } from 'lz-string';

import { Rdf } from 'platform/api/rdf';
import { SparqlUtil } from 'platform/api/sparql';
import { serialize, deserialize } from 'platform/api/json';

import { SearchProfileStore } from '../profiles/SearchProfileStore';
import * as FacetModel from '../facet/Model';
import {
  Category, Relation, Search, Resource, Conjunct, ConjunctKinds, TextDisjunctKind,
  RelationConjunct, TextConjunct, RelationDisjunct, TextDisjunct, DisjunctIndex,
} from './Model';

export interface RawState {
  search: Search;
  facet: FacetModel.Ast;
  result: { [componentId: string]: object };
}

export interface SerializedState {
  search: SerializedSearch;
  facet: SerializedFacet;
  result: object;
}

interface SerializedSearch {
  domain: string;
  conjuncts: SerializedConjunct[];
}

type SerializedConjunct = {
  uniqueId: number;
  relation?: SerializedConjunctBody;
  text?: SerializedConjunctBody;
};

interface SerializedConjunctBody {
  range: string;
  disjuncts: SerializedDisjunct[];
  relation?: string;
}

type SerializedDisjunct = [string, any] | string;

type SerializedFacet = SerializedConjunct[];

export class Serializer {
  serializeState(state: RawState): SerializedState {
    return {
      search: state.search ? this.serializeSearch(state.search) : undefined,
      facet: state.facet ? this.serializeFacet(state.facet) : undefined,
      result: state.result ? serialize(state.result) : undefined,
    };
  }

  private serializeSearch(search: Search): SerializedSearch {
    return {
      domain: this.compactIRI(search.domain.iri),
      conjuncts: search.conjuncts.map(this.serializeConjunct),
    };
  }

  private serializeFacet(ast: FacetModel.Ast): SerializedFacet {
    return ast.conjuncts.map(this.serializeConjunct);
  }

  private serializeConjunct = (conjunct: Conjunct): SerializedConjunct => {
    if (conjunct.kind === ConjunctKinds.Relation) {
      const relation = {
        range: this.compactIRI(conjunct.range.iri),
        relation: this.compactIRI(conjunct.relation.iri),
        disjuncts: conjunct.disjuncts.map(this.serializeRelationDisjunct),
      };
      return {relation, uniqueId: conjunct.uniqueId};
    } else if (conjunct.kind === ConjunctKinds.Text) {
      const text = {
        range: this.compactIRI(conjunct.range.iri),
        disjuncts: conjunct.disjuncts.map(d => d.value),
      };
      return {text, uniqueId: conjunct.uniqueId};
    } else {
      throw new Error(`Unknown conjunct kind`);
    }
  }

  private serializeRelationDisjunct = (disjunct: RelationDisjunct): SerializedDisjunct => {
    const value = disjunct.kind === 'Resource'
      ? this.serializeResource(disjunct.value)
      : serialize(disjunct.value);
    return [disjunct.kind, value];
  }

  private serializeResource(resource: Resource): any {
    // TODO: optimize here
    return serialize(resource);
    // return this.compactIRI(disjunct.value.iri);
  }

  private compactIRI(iri: Rdf.Iri): string {
    return SparqlUtil.compactIriUsingPrefix(iri);
  }
}

export class Deserializer {
  constructor(private store: SearchProfileStore) {}

  deserializeState(state: SerializedState): RawState {
    if (!state || typeof state !== 'object' || !state.search) {
      return {search: undefined, facet: undefined, result: {}};
    }
    const result = state.result ? deserialize(state.result) as any : undefined;
    return {
      search: this.deserializeSearch(state.search),
      facet: this.deserializeFacet(state.facet),
      result: result || {},
    };
  }

  private deserializeSearch(search: SerializedSearch): Search {
    return {
      domain: this.deserializeCategory(search.domain),
      conjuncts: search.conjuncts.map(this.deserializeConjunct),
    };
  }

  private deserializeFacet(facet: SerializedFacet): FacetModel.Ast {
    if (!facet) { return undefined; }
    const conjuncts = facet.map((conjunct, index) => {
      const deserialized = this.deserializeConjunct(conjunct, index);
      if (deserialized.kind !== ConjunctKinds.Relation) {
        throw new Error(`Unexpected conjunct kind for facet: ${deserialized.kind}`);
      }
      return deserialized;
    });
    return {conjuncts};
  }

  private deserializeConjunct = (conjunct: SerializedConjunct, conjunctIndex: number): Conjunct => {
    if (conjunct.relation) {
      const disjuncts = conjunct.relation.disjuncts;
      if (!(disjuncts && Array.isArray(disjuncts))) {
        throw new Error('Invalid disjuncts for serialized relation conjunct');
      }
      const relational: RelationConjunct = {
        uniqueId: conjunct.uniqueId,
        kind: ConjunctKinds.Relation,
        relation: this.deserializeRelation(conjunct.relation.relation),
        range: this.deserializeCategory(conjunct.relation.range),
        conjunctIndex: [conjunctIndex],
        disjuncts: disjuncts.map((disjunct, index) =>
          this.deserializeRelationDisjunct(disjunct, [conjunctIndex, index])),
      };
      return relational;
    } else if (conjunct.text) {
      const disjuncts = conjunct.text.disjuncts;
      if (!(disjuncts && Array.isArray(disjuncts))) {
        throw new Error('Invalid disjuncts for serialized text conjunct');
      }
      const text: TextConjunct = {
        uniqueId: conjunct.uniqueId,
        kind: ConjunctKinds.Text,
        range: this.deserializeCategory(conjunct.text.range),
        conjunctIndex: [conjunctIndex],
        disjuncts: disjuncts.map((disjunct, index) =>
          this.deserializeTextDisjunct(disjunct, [conjunctIndex, index])),
      };
      return text;
    } else {
      throw new Error('Invalid serialized conjunct');
    }
  }

  private deserializeRelationDisjunct(
    disjunct: SerializedDisjunct, disjunctIndex: DisjunctIndex
  ): RelationDisjunct {
    if (!(disjunct && Array.isArray(disjunct) && disjunct.length === 2)) {
      throw new Error('Invalid serialized relation disjunct');
    }
    const [kind, serialized] = disjunct;
    const value = kind === 'Resource'
      ? this.deserializeResource(serialized)
      : deserialize(serialized); // is deserialization vulnerable to XSS attacks?
    return {kind, value, disjunctIndex} as RelationDisjunct;
  }

  private deserializeTextDisjunct(
    disjunct: SerializedDisjunct, disjunctIndex: DisjunctIndex
  ): TextDisjunct {
    if (typeof disjunct !== 'string') {
      throw new Error('Invalid serialized text disjunct');
    }
    return {kind: TextDisjunctKind, value: disjunct, disjunctIndex};
  }

  private deserializeCategory(iri: string): Category {
    if (!iri) {
      throw new Error('Category IRI cannot be empty');
    }
    const categoryIri = this.expandIri(iri);
    const category = this.store.categories.get(categoryIri);
    if (!category) {
      throw new Error(`Category not found: ${categoryIri}`);
    }
    return category;
  }

  private deserializeRelation(iri: string): Relation {
    if (!iri) {
      throw new Error('Relation IRI cannot be empty');
    }
    const relationIri = this.expandIri(iri);
    const relation = this.store.relations.get(relationIri);
    if (!relation) {
      throw new Error(`Relation not found: ${relationIri}`);
    }
    return relation;
  }

  private deserializeResource(resource: any): Resource {
    // TODO: optimize here
    return deserialize<Resource>(resource);
    // return (?? load by IRI here ??)
  }

  private expandIri(iri: string): Rdf.Iri {
    return SparqlUtil.resolveIris([iri])[0];
  }
}

/**
 * Mapping between full and compact key representations for
 * `packState` and `unpackState` functions.
 */
const FullToCompact: Record<string, string> = {
  search: 's',
  facet: 'f',
  type: 't',
  domain: 'do',
  range: 'ra',
  relation: 're',
  text: 'te',
  conjuncts: 'c',
  disjuncts: 'd',
  '#type': 'T',
  '#value': 'V',
};

const CompactToFull = invert(FullToCompact) as Record<string, string>;

type PropertyMapper = (
  key: string,
  value: any,
  mapper: (target: any) => any
) => { key: string; value: any } | undefined;

function deepMapObject(target: any, propertyMapper: PropertyMapper): any {
  if (target === undefined && target === null) {
    return target;
  } else if (Array.isArray(target)) {
    return target.map(item => deepMapObject(item, propertyMapper));
  } else if (typeof target === 'object') {
    const result: any = {};
    for (const key of Object.keys(target)) {
      const value = target[key];
      const mapped = propertyMapper(key, value, child => deepMapObject(child, propertyMapper));
      if (mapped) {
        result[mapped.key] = mapped.value;
      }
    }
    return result;
  } else {
    return target;
  }
}

export function packState(state: SerializedState): any {
  return deepMapObject(state, (rawKey, value, mapper) => {
    let packedKey: string;
    if (rawKey.startsWith('@') || rawKey in CompactToFull) {
      packedKey = '@' + rawKey;
    } else {
      packedKey = FullToCompact[rawKey] || rawKey;
    }
    return {key: packedKey, value: mapper(value)};
  });
}

export function unpackState(state: any): SerializedState {
  return deepMapObject(state, (packedKey, value, mapper) => {
    let rawKey: string;
    if (packedKey.startsWith('@')) {
      rawKey = packedKey.substring(1);
    } else {
      rawKey = CompactToFull[packedKey] || packedKey;
    }
    return {key: rawKey, value: mapper(value)};
  });
}

export function serializeSearch(
  baseQuery: Search, facet?: FacetModel.Ast, result?: { [componentId: string]: object }
): string {
  const serialized = new Serializer().serializeState({
    search: baseQuery,
    facet: facet,
    result: result,
  });

  const packed = packState(serialized);
  const packedJson = JSON.stringify(packed);
  return compressToEncodedURIComponent(packedJson);
}
