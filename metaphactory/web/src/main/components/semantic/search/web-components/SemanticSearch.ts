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

import { DOM as D,
         Props as ReactProps,
       } from 'react';
import * as _ from 'lodash';
import * as Kefir from 'kefir';
import * as Maybe from 'data.maybe';
import { decompressFromEncodedURIComponent } from 'lz-string';

import { Cancellation } from 'platform/api/async';
import {
  getCurrentUrl, getCurrentResource, constructUrlForResource,
} from 'platform/api/navigation';
import { Component } from 'platform/api/components';

import { addNotification } from 'platform/components/ui/notification';

import { SemanticSearchConfig } from '../config/SearchConfig';
import * as SearchDefaults from '../config/Defaults';
import * as Model from '../data/search/Model';
import {
  RawState, Deserializer, unpackState, serializeSearch,
} from '../data/search/Serialization';
import * as FacetModel from '../data/facet/Model';
import {
  InitialQueryContextTypes, ResultContextTypes, SemanticSearchContext, FacetContextTypes,
  ResultOperation, ExtendedSearchValue,
} from './SemanticSearchApi';
import {
  SearchProfileStore, createSearchProfileStore,
} from '../data/profiles/SearchProfileStore';

export interface Props extends ReactProps<SemanticSearch>, SemanticSearchConfig {}
interface State {
  domain?: Data.Maybe<Model.Category>
  baseQuery?: Data.Maybe<SparqlJs.SelectQuery>
  baseQueryStructure?: Data.Maybe<Model.Search>
  facetStructure?: FacetModel.Ast
  extendedSearch?: Data.Maybe<{value: ExtendedSearchValue, range: Model.Category}>
  resultQuery?: Data.Maybe<SparqlJs.SelectQuery>
  searchProfileStore?: Data.Maybe<SearchProfileStore>
  hasFacet?: boolean
  resultsLoaded?: boolean
  resultState?: { [componentId: string]: object }
}

const SAVED_STATE_QUERY_KEY = 'semanticSearch';

export class SemanticSearch extends Component<Props, State> {
  static defaultProps: Partial<Props> = {
    optimizer: 'blazegraph',
    categories: SearchDefaults.DefaultTextPattern(),
    searchProfile: {
      categoriesQuery: SearchDefaults.DefaultSearchProfileCategoriesQuery,
      relationsQuery: SearchDefaults.DefaultSearchProfileRelationsQuery,
      defaultProfile: SearchDefaults.DefaultProfile,
    },
    limit: SearchDefaults.ResultLimit,
    selectorMode: 'stack',
  };

  private readonly cancellation = new Cancellation();

  private savingState = this.cancellation.derive();
  private serializedState: string;

  private loadingResults = this.cancellation.derive();
  private activeResultOperations = 0;
  private resultCount: number | undefined;

  constructor(props: Props, context: any) {
    super(props, context);
    this.state = {
      domain: Maybe.Nothing<Model.Category>(),
      baseQuery: Maybe.Nothing<SparqlJs.SelectQuery>(),
      baseQueryStructure: Maybe.Nothing<Model.Search>(),
      resultQuery: Maybe.Nothing<SparqlJs.SelectQuery>(),
      searchProfileStore: Maybe.Nothing<SearchProfileStore>(),
      extendedSearch: Maybe.Nothing<{
        value: ExtendedSearchValue,
        range: Model.Category,
      }>(),
      hasFacet: false,
      resultState: {},
    };
  }

  static childContextTypes = {
    ...Component.childContextTypes,
    ...InitialQueryContextTypes,
    ...ResultContextTypes,
    ...FacetContextTypes,
  };
  getChildContext() {
    const context: SemanticSearchContext = {
      baseQuery: this.state.baseQuery,
      useInExtendedFcFrSearch: this.useInExtendedFcFrSearch,
      extendedSearch: this.state.extendedSearch,
      baseQueryStructure: this.state.baseQueryStructure,
      resultsStatus: {loaded: this.state.resultsLoaded, count: this.resultCount},
      facetStructure: Maybe.fromNullable(this.state.facetStructure),
      baseConfig: this.props,
      domain: this.state.domain,
      setDomain: this.setDomain,
      setBaseQuery: this.setBaseQuery,
      setBaseQueryStructure: this.setBaseQueryStructure,
      setFacetStructure: this.setFacetStructure,
      setFacetedQuery: this.setFacetedQuery,
      resultQuery: this.state.resultQuery,
      searchProfileStore: this.state.searchProfileStore,
      bindings: {},
      notifyResultLoading: this.notifyResultLoading,
      resultState: this.state.resultState,
      updateResultState: this.updateResultState,
    };
    return {...super.getChildContext(), ...context};
  }

  componentDidMount() {
    if (this.props.searchProfile) {
      this.cancellation.map(
        createSearchProfileStore(this.props, this.props.searchProfile)
      ).onValue(store => {
        const savedState = this.getStateFromHistory(store, {reload: true});
        this.setState({
          searchProfileStore: Maybe.Just(store),
          baseQueryStructure: savedState.chain(state => Maybe.fromNullable(state.search)),
          facetStructure: savedState
            .chain(state => Maybe.fromNullable(state.facet))
            .getOrElse(undefined),
          resultState: savedState.map(state => state.result).getOrElse({}),
        });
      });
    }
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  private useInExtendedFcFrSearch =
    (item: {value: ExtendedSearchValue, range: Model.Category}) =>
    this.setState({
      extendedSearch: Maybe.Just(item),
      facetStructure: null, // reset facet when creating extended search
    })

  private setBaseQuery = (query: Data.Maybe<SparqlJs.SelectQuery>) => {
    this.setState((state): State => {
      this.listenForResultsLoading();
      return {
        baseQuery: query,
        facetStructure: query.map(_ => state.facetStructure).getOrElse(null), // reset facet when base query is also reset
        hasFacet: query.isJust ? state.hasFacet : false,
        resultQuery: query,
        resultsLoaded: false,
      };
    });
  }

  private setBaseQueryStructure = (baseQueryStructure: Data.Maybe<Model.Search>) => {
    if (baseQueryStructure === this.state.baseQueryStructure) { return; }

    if (baseQueryStructure.isJust) {
      const queryStructure = _.cloneDeep(baseQueryStructure.get());
      this.setState({
        baseQueryStructure: Maybe.Just(queryStructure),
        resultState: {},
      });
      this.saveStateIntoHistory({
        search: queryStructure,
        facet: this.state.facetStructure,
        result: {},
      });
    } else {
      this.setState({baseQueryStructure: Maybe.Nothing<Model.Search>()});
      this.clearCurrentHistoryItem();
    }
  }

  private setFacetStructure = (facetStructure: FacetModel.Ast) => {
    const facetAstCopy = _.cloneDeep(facetStructure);
    this.setState({facetStructure: facetAstCopy});
    this.saveStateIntoHistory({
      search: this.state.baseQueryStructure.getOrElse(undefined),
      facet: facetAstCopy,
      result: this.state.resultState,
    });
  }

  private setFacetedQuery = (query: SparqlJs.SelectQuery) => {
    this.listenForResultsLoading();
    this.setState({
      resultQuery: Maybe.Just(query),
      hasFacet: true,
      resultsLoaded: false,
    });
  }

  private setDomain = (domain: Model.Category) => {
    this.setState({domain: Maybe.Just(domain)});
  }

  private listenForResultsLoading() {
    this.loadingResults = this.cancellation.deriveAndCancel(this.loadingResults);
    this.activeResultOperations = 0;
    this.resultCount = undefined;
  }

  render() {
    return D.div({}, this.props.children);
  }

  private getStateFromHistory = (
    profileStore: SearchProfileStore,
    params: { reload?: boolean } = {}
  ): Data.Maybe<RawState> => {
    const compressed = (params.reload || this.serializedState === undefined)
      ? getCurrentUrl().query(true)[SAVED_STATE_QUERY_KEY]
      : this.serializedState;

    if (typeof compressed === 'string') {
      try {
        const packedJson = decompressFromEncodedURIComponent(compressed);
        const packed = JSON.parse(packedJson);
        const serialized = unpackState(packed);
        const raw = new Deserializer(profileStore).deserializeState(serialized);
        return Maybe.Just(raw);
      } catch (error) {
        if (params.reload) {
          addNotification({level: 'warning', message: 'Error restoring search state'});
        }
        console.error('Error restoring search state: ', error);
        return Maybe.Nothing<RawState>();
      }
    } else {
      return Maybe.Nothing<RawState>();
    }
  }

  private saveStateIntoHistory = (state: RawState) => {
    const previousState = this.state.searchProfileStore
      .map(store => this.getStateFromHistory(store))
      .getOrElse(Maybe.Nothing<RawState>());

    const compressed = serializeSearch(
      state.search || previousState.map(s => s.search).getOrElse(undefined),
      state.facet || previousState.map(s => s.facet).getOrElse(undefined),
      state.result
    );

    if (compressed === this.serializedState) { return; }
    this.serializedState = compressed;

    this.savingState.cancelAll();
    this.savingState = this.cancellation.derive();

    // when updating query string we need to make sure that we keep all
    // other query parameters, e.g repository
    const currentUrl = getCurrentUrl().clone();
    currentUrl.removeSearch(SAVED_STATE_QUERY_KEY)
      .addSearch({[SAVED_STATE_QUERY_KEY]: compressed});
    this.savingState.map(
      Kefir.constant(currentUrl)
    ).onValue(url => {
      window.history.replaceState({}, '', url.toString());
    });
  }

  private clearCurrentHistoryItem() {
    this.savingState.cancelAll();
    const currentUri = getCurrentUrl();
    if (SAVED_STATE_QUERY_KEY in currentUri.query(true)) {
      window.history.replaceState({}, '',
        currentUri.clone().removeQuery(SAVED_STATE_QUERY_KEY).toString());
    }
  }

  private notifyResultLoading = (operation: ResultOperation) => {
    this.activeResultOperations++;
    const task: Kefir.Observable<number | void> = operation.task;
    this.loadingResults.map(task).observe({
      value: result => {
        this.activeResultOperations--;
        if (operation.type === 'count' && typeof result === 'number') {
          this.resultCount = result;
        }
        if (this.activeResultOperations === 0) {
          this.setState({resultsLoaded: true});
        }
      },
    });
  }

  private updateResultState = (componentId: string, stateChange: object) => {
    this.setState(({resultState}): State => ({
      resultState: {
        ...resultState,
        [componentId]: {...resultState[componentId], ...stateChange} as object,
      },
    }), () => this.saveStateIntoHistory({
      search: this.state.baseQueryStructure.get(),
      facet: this.state.facetStructure,
      result: this.state.resultState,
    }));
  }
}

export default SemanticSearch;
