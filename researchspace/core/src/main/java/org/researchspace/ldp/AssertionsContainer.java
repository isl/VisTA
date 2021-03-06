/*
 * Copyright (C) 2015-2017, © Trustees of the British Museum
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

package org.researchspace.ldp;

import javax.inject.Inject;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.impl.LinkedHashModel;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryException;

import com.google.common.base.Throwables;
import com.google.inject.Provider;
import com.metaphacts.data.rdf.PointedGraph;
import com.metaphacts.data.rdf.container.AbstractLDPContainer;
import com.metaphacts.data.rdf.container.LDPR;
import com.metaphacts.data.rdf.container.RootContainer;
import com.metaphacts.vocabulary.LDP;

/**
 * @author Artem Kozlov <ak@metaphacts.com>
 */
@LDPR(iri=AssertionsContainer.IRI_STRING)
public class AssertionsContainer extends AbstractLDPContainer {
    public static final String IRI_STRING = "http://www.researchspace.org/ontology/Assertions.Container";
    public static final IRI IRI = vf.createIRI(IRI_STRING);

    @Inject
    private Provider<RootContainer> rootContainer;

    public AssertionsContainer(IRI iri, Repository repository) {
        super(iri, repository);
    }

    public void initialize() {
        if (!getReadConnection().hasOutgoingStatements(this.getResourceIRI())) {
            LinkedHashModel m = new LinkedHashModel();
            m.add(vf.createStatement(IRI, RDF.TYPE, LDP.Container));
            m.add(vf.createStatement(IRI, RDF.TYPE, LDP.Resource));
            m.add(vf.createStatement(IRI, RDFS.LABEL, vf.createLiteral("Assertions Container")));
            try {
                rootContainer.get().add(new PointedGraph(IRI, m));
            } catch (RepositoryException e) {
                throw Throwables.propagate(e);
            }
        }
    }
}